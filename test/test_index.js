/**
 * Created by zhangliming on 14-7-29.
 */


var YRedis=require('../index');

var yredis=YRedis.getClient({servers:'127.0.0.1:2181',chroot:'/'});

yredis.on('ok',function(){
    yredis.SET('aaa',1,function(err,r){
        console.log(err,r);
    });
    yredis.decrby('aaa',1,function(err,r){
        console.log(err,r);
    });

});
