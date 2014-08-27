/**
 * Created by zhangliming on 14-7-24.
 */
'use strict';

var redisFailover = require('node-redis-failover');
var underscore=require('underscore');
var util=require('util');
var EventEmitter = require('events').EventEmitter;

var server={master:{},slaves:[]},man;

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


    function getServer(redisfl){
        var name=Object.keys(redisfl.redisState)[0];
        server.master=redisfl.getClient(name,'master');
        var len=redisfl.redisState[name].slaves.length;
        for(var i=0;i<len;i++){
            server.slaves.push(redisfl.getClient(name,'slave'));
        }

    }
};



function DSPRedis(zkConfig,readCommands,writeCommands){
    this.zkConfig=zkConfig;
    this.readCommands=readCommands||[];
    this.writeCommands=writeCommands||[];
    this.rr=0;

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

        if(server.master=={})return;
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
            var slaveNum=server.slaves.length,slave;
            if(slaveNum>0){
                //var rnd = underscore.random(0,slaveNum-1);
                self.rr=(self.rr+1)%slaveNum;
                slave=server.slaves[self.rr];

            }else{
                slave=server.master;
            }

            if (Array.isArray(args) && typeof callback === "function") {
                slave.send_command(command, args, callback);
            } else {
                slave.send_command(command, to_array(arguments));
            }

        };
        DSPRedis.prototype[command.toUpperCase()] =  DSPRedis.prototype[command];
    });
};



DSPRedis.prototype._initWriteCommands=function(){
    this.writeCommands.forEach(function(command){
        DSPRedis.prototype[command]=function(args, callback){
            if (Array.isArray(args) && typeof callback === "function") {
                server.master.send_command(command, args, callback);
            } else {
                server.master.send_command(command, to_array(arguments));
            }
        };
        DSPRedis.prototype[command.toUpperCase()] =  DSPRedis.prototype[command];
    });
};





function to_array(args) {
    var len = args.length,
        arr = new Array(len), i;

    for (i = 0; i < len; i += 1) {
        arr[i] = args[i];
    }

    return arr;
}




exports.getClient = function (zkConfig,readCommands,writeCommands) {
    var dspredis = new DSPRedis(zkConfig,readCommands,writeCommands);
    return dspredis;
};



