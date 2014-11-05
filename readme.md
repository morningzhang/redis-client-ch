
use zookeeper mangage redis cluster and write to master and read from slave
-------
![Image text](http://raw.github.com/morningzhang/redis-client-ch/master/image/redis_ha_for_setting.png)


So ,we should have a ping server,install like this: <br/>
1.npm install -g node-redis-failover <br/>
2.cd to bin and  ./redis-failover -c ../examples/config.json <br/>

In the client , use like this:

```javascript

var YRedis=require('../index');
//four parameters，
//1.zookeeper config
//2.read commands.it can be empty array
//3.write command.it can be empty array
//4.key router function
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

```

