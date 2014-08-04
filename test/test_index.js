/**
 * Created by zhangliming on 14-7-29.
 */


var YRedis=require('../index');

var yredis=YRedis.getClient({servers:'172.20.0.47:2181,172.20.0.48:2181,172.20.0.49:2181',chroot:'/'},['sinter','mget','hgetall','ttl'],['set','incr','incrby','decrby','expire']);

yredis.on('ok',function(){
    yredis.SET('aaa',12,function(err,r){
        console.log(err,r);
    });
    yredis.decrby('aaa',-1,function(err,r){
        console.log(err,r);
    });
    yredis.addReadCommands('get');
    yredis.get('aaa',function(err,r){
        console.log(err,r);
    });

});

/*
var underscore=require('underscore');
console.log(underscore.random(0,1));*/
