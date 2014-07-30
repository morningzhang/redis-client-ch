/**
 * Created by zhangliming on 14-7-24.
 */
'use strict';

var redisFailover = require('node-redis-failover');
var util=require('util');
var EventEmitter = require('events').EventEmitter;

var server={master:{},slave:{}},man;

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
        server.slave=redisfl.getClient(name,'slave');
    }
};



function DSPRedis(zkConfig){
    this.zkConfig=zkConfig;
    this.init();
    EventEmitter.call(this);
}
util.inherits(DSPRedis, EventEmitter);

DSPRedis.prototype.init=function(){
    var self=this;

    if(!man){
        man=new DSPRedisManager(this.zkConfig);
    }
    var readCommands=['get','sinter','mget','hgetall'];
    var writeCommands=['set','incr','incrby','decrby','multi'];


    man.on('ok',function(){

        readCommands.forEach(function(command){
            DSPRedis.prototype[command]=function(args, callback){
                if (Array.isArray(args) && typeof callback === "function") {
                     server.slave.send_command(command, args, callback);
                } else {
                     server.slave.send_command(command, to_array(arguments));
                }
            };
            DSPRedis.prototype[command.toUpperCase()] =  DSPRedis.prototype[command];
        });

        writeCommands.forEach(function(command){
            DSPRedis.prototype[command]=function(args, callback){
                if (Array.isArray(args) && typeof callback === "function") {
                    server.master.send_command(command, args, callback);
                } else {
                    server.master.send_command(command, to_array(arguments));
                }
            };
            DSPRedis.prototype[command.toUpperCase()] =  DSPRedis.prototype[command];
        });



        function to_array(args) {
            var len = args.length,
                arr = new Array(len), i;

            for (i = 0; i < len; i += 1) {
                arr[i] = args[i];
            }

            return arr;
        }

        self.emit('ok');
    });
};






exports.getClient = function (zkConfig) {


    var dspredis = new DSPRedis(zkConfig);

    return dspredis;
};



