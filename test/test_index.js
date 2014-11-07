/**
 * Created by zhangliming on 14-7-29.
 */


var YRedis=require('../index');

//four parameters，
//1.zookeeper config
//2.read commands.it can be empty array
//3.write command.it can be empty array
//4.key router function
var yredis=YRedis.getClient({servers:'172.20.0.47:2181',chroot:'/qa-test'});

yredis.on('ok',function(){
    yredis.addReadCommands(['get','sinter','mget','hgetall','ttl']).addWriteCommands(['set','incr','incrby','decrby','expire']).setKeyDispatcher(function(servers,command,sendArgs,sendCallback){
        var len=servers.length;
        if(sendArgs[0]){
            var key=sendArgs[0];
            var val=Buffer.byteLength(key, 'utf8')%len;
            console.log('=>',key,val);
            return val;
        }
        return 0;
    });
    yredis.SET('aaa',12,function(err,r){
        console.log(err,r);
    });
    yredis.decrby('aaa',-1,function(err,r){
        console.log(err,r);
    });

    yredis.get('aaa',function(err,r){
        console.log(err,r);
    });

    yredis.SET('aa',12,function(err,r){
        console.log(err,r);
    });
    yredis.decrby('aa',-1,function(err,r){
        console.log(err,r);
    });
    yredis.get('aa',function(err,r){
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
