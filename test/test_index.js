/**
 * Created by zhangliming on 14-7-29.
 */


var YRedis=require('../index');

var yredis=YRedis.getClient({servers:'172.20.0.47:2181',chroot:'/'},['sinter','mget','hgetall','ttl'],['set','incr','incrby','decrby','expire'],function(servers,command,sendArgs,sendCallback){
    var len=servers.length;
    if(sendArgs[1]){
        var key=sendArgs[0];
        var val=Buffer.byteLength(key, 'utf8')%len;
        console.log('=>',key,val);
        return val;
    }
    return 0;
});

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
    //console.log(yredis.getServers());
    console.log(yredis.getMasterServer().name);
    var slaves= yredis.getSlaveServers()||[];

    slaves.forEach(function(slave){
        console.log(slave.name);
    });

});

/*
 var underscore=require('underscore');
 console.log(underscore.random(0,1));*/
