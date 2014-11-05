/**
 * Created by zhangliming on 14-7-24.
 */
'use strict';

var redisFailover = require('./client.js');
var util=require('util');
var EventEmitter = require('events').EventEmitter;

var servers=[];

function DSPRedisManager(zkConfig){
    this.zkConfig=zkConfig;
    this.init();
    EventEmitter.call(this);
}
util.inherits(DSPRedisManager, EventEmitter);

DSPRedisManager.prototype.init=function(){
    var self=this;
    var redisfl = redisFailover.createClient(this.zkConfig);

    redisfl.on('ready', function () {
        getServer(redisfl);
        self.emit('ok');
    });

    redisfl.on('change', function (name, state) {
        console.log('redis %s state changed, %j', name, state);
        getServer(redisfl);
    });

    redisfl.on('masterChange', function (name, state) {
        console.log('%s master changed, %s', name, state);
        getServer(redisfl);
    });

    redisfl.on('error', function (err) {
        console.error('err,', err);
    });

    redisfl.on('nodeAdd', function (name, state) {
        console.log('new node add to cluster name: %s, state: %j', name, state);
        console.log('client1 master: %s', redisfl.getClient(name).name);
        getServer(redisfl);
    });

    function getServer(redisfl) {
        var names = Object.keys(redisfl.redisState);
        names.forEach(function(name){
            var server={};
            server.master = redisfl.getClient(name, 'master');
            var len = redisfl.redisState[name].slaves.length;
            for (var i = 0; i < len; i++) {
                server.slaves.push(redisfl.getClient(name, 'slave'));
            }
            servers.push(server);
        });
        //console.log(servers);
    }
};


var man;
function DSPRedis(zkConfig,readCommands,writeCommands,keyDispatcher){
    this.zkConfig=zkConfig;
    this.readCommands=readCommands||[];
    this.writeCommands=writeCommands||[];
    this.keyDispatcher=keyDispatcher;
    this.rr=[];
    this._init();
    EventEmitter.call(this);
}
util.inherits(DSPRedis, EventEmitter);

DSPRedis.prototype._init=function(){
    var self=this;

    if(!man) {
        man = new DSPRedisManager(this.zkConfig);
    }


    man.on('ok',function(){

        if(servers.length==0)return;
        //init rr
        var serversNum=servers.length;
        for(var i=0;i<serversNum;i++){
            self.rr[i]={slaves:0};
        }
        //init commands
        self._initReadCommands();
        self._initWriteCommands();

        var addCommandMethods=['addReadCommands','addWriteCommands'];

        addCommandMethods.forEach(function(addCommandMethod){

            DSPRedis.prototype[addCommandMethod]=function(newCommands){
                if(!newCommands)return;
                var addedCommandPropNameTemp=addCommandMethod.split('add')[1];
                var addedCommandPropName=addedCommandPropNameTemp[0].toLowerCase()+addedCommandPropNameTemp.substr(1);
                var initCommandMethodName='_init'+addedCommandPropNameTemp;

                this[addedCommandPropName]=this[addedCommandPropName].concat(newCommands);
                this[initCommandMethodName]();
            };

        });

        self.emit('ok');
    });
};
DSPRedis.prototype._initReadCommands=function(){
    var self=this;
    this.readCommands.forEach(function(command){
        DSPRedis.prototype[command]=function(args, callback){
            var sendArgs=[],sendCallback;
            if (Array.isArray(args) && typeof callback === "function") {
                sendArgs=args;
                sendCallback=callback;
            } else {
                sendArgs=to_array(arguments);
            }
            var index=0;
            if(!!self.keyDispatcher&&typeof self.keyDispatcher=='function'){
                index=self.keyDispatcher(servers,command,sendArgs,sendCallback);
                if(isNaN(index)||index>=servers.length||index<0){
                    index=0;
                }
            }
            var slaves=servers[index].slaves;
            var slaveNum=slaves===undefined?0:slaves.length,slave,rr=self.rr[index].slaves;
            if(slaveNum>0){
                rr=(rr+1)%slaveNum;
                slave=servers[index].slaves[rr];
            }else{
                slave=servers[index].master;
            }

            if (!!sendCallback) {
                slave.send_command(command, sendArgs, sendCallback);
            } else {
                slave.send_command(command, sendArgs);
            }

        };
        DSPRedis.prototype[command.toUpperCase()] =  DSPRedis.prototype[command];
    });
};



DSPRedis.prototype._initWriteCommands=function(){
    var self=this;
    this.writeCommands.forEach(function(command){
        DSPRedis.prototype[command]=function(args, callback){
            var sendArgs=[],sendCallback;
            if (Array.isArray(args) && typeof callback === "function") {
                sendArgs=args;
                sendCallback=callback;
            } else {
                sendArgs=to_array(arguments);
            }
            var index=0;
            if(!!self.keyDispatcher&&typeof self.keyDispatcher=='function'){
                index=self.keyDispatcher(servers,command,sendArgs,sendCallback);
                if(isNaN(index)||index>=servers.length||index<0){
                    index=0;
                }
            }

            var master=servers[index].master;

            if (!!sendCallback) {
                master.send_command(command, sendArgs, sendCallback);
            } else {
                master.send_command(command, sendArgs);
            }

        };
        DSPRedis.prototype[command.toUpperCase()] =  DSPRedis.prototype[command];
    });
};

DSPRedis.prototype.getServers=function(){
    return servers;
};

DSPRedis.prototype.getMasterServer=function(index){
    index = index === undefined ? 0 : index;
    return servers[index].master;
};

DSPRedis.prototype.getSlaveServers=function(index){
    index = index === undefined ? 0 : index;
    return servers[index].slaves;
};



function to_array(args) {
    var len = args.length,
        arr = new Array(len), i;
    for (i = 0; i < len; i += 1) {
        arr[i] = args[i];
    }
    return arr;
}




exports.getClient = function (zkConfig,readCommands,writeCommands,keyDispatcher) {
    var dspredis = new DSPRedis(zkConfig,readCommands,writeCommands,keyDispatcher);
    return dspredis;
};