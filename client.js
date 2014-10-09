/**
 * Created by zhangliming on 14-10-9.
 */
var Client = require('node-redis-failover/lib/client');
var async = require('async');
Client.prototype.setState = function(name, state, callback) {
    if (!this.redisState[name]) {
        this.watchZkData(name);
    }

    if (!state) {
        callback && callback();
        return;
    }

    this.redisState[name] = state;

    var self = this;
    async.waterfall([
        function (cb) {
            if (state.master) {
                self.addClient(state.master, state.password, function () {
                    cb(null, 1);
                });
            }
        },
        function (n, cb) {
            if (state.slaves) {
                var slaveSize=0;
                async.eachSeries(state.slaves, function (name, cb1) {
                    self.addClient(name, state.password, function(){
                        cb1(null,slaveSize++);
                    });
                }, function (err) {
                    if(err){
                        cb(err,-1);
                    }else{
                        cb(null,n+slaveSize);
                    }
                });
            }
        }

    ], function (err, result) {
        if(err){
            console.log(err);
            return;
        }
        callback && callback();
    });

};
exports.createClient = function(opts) {
    return new Client(opts);
};
