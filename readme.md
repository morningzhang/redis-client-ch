
use zookeeper mangage redis cluster and write to master and read from slave
-------
![Image text](http://raw.github.com/morningzhang/redis-client-ch/master/image/redis_ha_for_setting.png)


So ,we should have a ping server,install like this: <br/>
1.npm install -g node-redis-failover <br/>
2.cd to bin and  ./redis-failover -c ../examples/config.json <br/>

In the client , use like this:

```javascript
var YRedis=require('../index');
//three parameters，1.zookeeper config，2.read commands，3.write command
var yredis=YRedis.getClient({servers:'127.0.0.1:2181',chroot:'/'},['sinter','mget','hgetall','ttl'],['set','incr','incrby','decrby','expire']);

yredis.on('ok',function(){
    yredis.SET('aaa',1,function(err,r){
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
```

