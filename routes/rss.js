var Q=require('q');

var log = require('../log.js');
var errorHandle=require('../errorHandle.js');
var utils = require('../utils.js');
var appSettings = require('../appSettings.js');

module.exports = function(app){

  app.get('/rss/:language', function(req, res,next){
    var apiResult = {
      code:'200',
      message:'OK'
    };

    if(req.params.language){
        if(req.params.language=="es"){
            var url="http://project.ecolearning.eu/es/feed/";
        } else if(req.params.language=="it"){
            var url="http://project.ecolearning.eu/it/feed/";
        } else if(req.params.language=="fr"){
            var url="http://project.ecolearning.eu/fr/feed/";
        } else if(req.params.language=="de"){
            var url="http://project.ecolearning.eu/de/feed/";
        } else if(req.params.language=="pt"){
            var url="http://project.ecolearning.eu/pt-pt/feed/";
        } else {
            var url="http://project.ecolearning.eu/feed/";
        }
    }


    utils.urlGETRequest(url, appSettings.httpRequestTimeout)
    .then(function(data){
        res.send(data);
    });

  });
}




