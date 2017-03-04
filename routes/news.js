var log = require('../log.js');
var errorHandle=require('../errorHandle.js');
var models=require('../models.js');

module.exports = function(app){

  app.get('/news/:language', function(req, res,next){
    var apiResult = {
      code:'200',
      message:'OK'
    };


    log('/get news: '+ JSON.stringify(req.params));
    models.rssArticle.find().sort([['pubDate', 'descending']]).exec(function(err, articles){
        if(articles){
            res.json(articles);
        } else {
            res.json(apiResult);
        }
    });
  });

  app.get('/news', function(req, res,next){
    log('/get news');
    var apiResult = {
      code:'200',
      message:'OK'
    };


    if(!req.query || !req.query.appId ){
        res.json(apiResult);
        return;
    }

    models.appInstance.findOne({_id:req.query.appId}).exec(function(err, theAppInstance){
        if(theAppInstance){
            try {
              theAppInstance.lastIp=req.headers['x-forwarded-for'] || req.connection.remoteAddress;
              theAppInstance.lastConnected=new Date(),
              theAppInstance.save();
            } catch(e){}
        }

        models.rssArticle.find().sort([['pubDate', 'descending']]).exec(function(err, articles){
          if(articles){
              res.json(articles);
          } else {
              res.json(apiResult);
          }
        });
    });
  });
}
