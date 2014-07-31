读写分离的包
====
```javascript
var YRedis=require('../index');

var yredis=YRedis.getClient({servers:'127.0.0.1:2181',chroot:'/'},['get','sinter','mget','hgetall','ttl'],['set','incr','incrby','decrby','expire']);

yredis.on('ok',function(){
    yredis.SET('aaa',1,function(err,r){
        console.log(err,r);
    });
    yredis.decrby('aaa',1,function(err,r){
        console.log(err,r);
    });

});
```