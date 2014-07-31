采用zk管理redis集群，写master，随机选取读slave
-------
```javascript
var YRedis=require('../index');
//三个参数，1。zk的配置，2。读的命令，3。写的命令
var yredis=YRedis.getClient({servers:'127.0.0.1:2181',chroot:'/'},
['get','sinter','mget','hgetall','ttl'],
['set','incr','incrby','decrby','expire']);

yredis.on('ok',function(){
    yredis.SET('aaa',1,function(err,r){
        console.log(err,r);
    });
    yredis.decrby('aaa',1,function(err,r){
        console.log(err,r);
    });

});
```