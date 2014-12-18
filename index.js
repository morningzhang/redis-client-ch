/**
 * Created by zhangliming on 14-7-24.
 */
'use strict';

var redisFailover = require('./client.js');
var util=require('util');
var EventEmitter = require('events').EventEmitter;



function DSPRedisManager(zkConfig){
    this.zkConfig=zkConfig;
    this.servers=[];
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
            if(len>0){
                server.slaves=[];
                for (var i = 0; i < len; i++) {
                    var slave=redisfl.getClient(name, 'slave');
                    server.slaves.push(slave);
                }
            }

            self.servers.push(server);
        });
        //console.log(servers);
    }
};

DSPRedisManager.prototype.getServers=function(){
    return this.servers;
};

function DSPRedis(zkConfig,readCommands,writeCommands,keyDispatcher){
    this.zkConfig=zkConfig;
    this.readCommands=readCommands||[];
    this.writeCommands=writeCommands||[];
    this.keyDispatcher=keyDispatcher;

    this.manager=new DSPRedisManager(zkConfig);
    this.rr=[];
    this._init();
    EventEmitter.call(this);
}
util.inherits(DSPRedis, EventEmitter);

DSPRedis.prototype._init=function(){
    var self=this;

    this.manager.on('ok',function(){

        if(self.getServers().length==0)return;
        //init rr
        self._initRr();
        //init commands
        self._initReadCommands();
        self._initWriteCommands();

        var addCommandMethods=['addReadCommands','addWriteCommands'];

        addCommandMethods.forEach(function(addCommandMethod){

            DSPRedis.prototype[addCommandMethod]=function(newCommands){
                if(!newCommands)return;
                var commands=[];
                commands=commands.concat(newCommands);
                var self=this;
                commands.forEach(function(command){
                    var addCommandFunctionName='_'+addCommandMethod.substring(0,addCommandMethod.length-1);
                    self[addCommandFunctionName](command);
                });
                return this;
            };

        });

        self.emit('ok');
    });
};

DSPRedis.prototype._initRr=function(){
    var serversNum=this.getServers().length;
    for(var i=0;i<serversNum;i++){
        this.rr[i]=0;
    }
};

DSPRedis.prototype._initReadCommands=function(){
    var self=this;
    this.readCommands.forEach(function(command){
        self._addReadCommand(command);
    });
};

DSPRedis.prototype._addReadCommand=function(command){
    var self = this;
    DSPRedis.prototype[command] = function (args, callback) {
        var sendArgs = [], sendCallback;
        if (Array.isArray(args) && typeof callback === "function") {
            sendArgs = args;
            sendCallback = callback;
        } else {
            sendArgs = to_array(arguments);
        }

        var index = 0,servers=this.getServers();
        if (self.keyDispatcher && typeof self.keyDispatcher == 'function') {
            index = self.keyDispatcher(servers, command, sendArgs, sendCallback);
            if (isNaN(index) || index >= servers.length || index < 0) {
                index = 0;
            }
        }

        var server=servers[index];
        var slaves = server.slaves,master=server.master;

        var slaveNum = slaves === undefined ? 0 : slaves.length,slave;
        if (slaveNum > 0) {
            var rrv = self.rr[index];
            rrv = (rrv + 1) % slaveNum;
            self.rr[index]=rrv;

            slave = slaves[rrv];
        } else {
            slave = master;
        }

        if (sendCallback) {
            slave.send_command(command, sendArgs, sendCallback);
        } else {
            slave.send_command(command, sendArgs);
        }

    };
    DSPRedis.prototype[command.toUpperCase()] = DSPRedis.prototype[command];
};

DSPRedis.prototype._initWriteCommands=function(){
    var self=this;
    this.writeCommands.forEach(function(command){
       self._addWriteCommand(command);
    });
};

DSPRedis.prototype._addWriteCommand = function (command) {
    var self = this;
    DSPRedis.prototype[command] = function (args, callback) {
        var sendArgs = [], sendCallback;
        if (Array.isArray(args) && typeof callback === "function") {
            sendArgs = args;
            sendCallback = callback;
        } else {
            sendArgs = to_array(arguments);
        }
        var index = 0,servers=this.getServers();
        if (self.keyDispatcher && typeof self.keyDispatcher == 'function') {
            index = self.keyDispatcher(servers, command, sendArgs, sendCallback);
            if (isNaN(index) || index >= servers.length || index < 0) {
                index = 0;
            }
        }

        var master = servers[index].master;

        if (sendCallback) {
            master.send_command(command, sendArgs, sendCallback);
        } else {
            master.send_command(command, sendArgs);
        }

    };
    DSPRedis.prototype[command.toUpperCase()] = DSPRedis.prototype[command];
};

DSPRedis.prototype.getServers=function(){
    return this.manager.getServers();
};

DSPRedis.prototype.setKeyDispatcher=function(keyDispatcher){
     this.keyDispatcher=keyDispatcher;
     return this;
};

DSPRedis.prototype.getMasterServer=function(index){
    index = index === undefined ? 0 : index;
    return this.getServers()[index].master;
};

DSPRedis.prototype.getSlaveServers=function(index){
    index = index === undefined ? 0 : index;
    return this.getServers()[index].slaves;
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
    var dspredis = new DSPRedis(zkConfig,readCommands||[],writeCommands||[],keyDispatcher);
    return dspredis;
};