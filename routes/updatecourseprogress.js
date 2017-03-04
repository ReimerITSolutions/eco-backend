var async = require('async');
var moment = require('moment');
var cors = require('cors');

var log = require('../log.js');
var errorHandle=require('../errorHandle.js');
var models=require('../models.js');
var utils = require('../utils.js');
var appSettings = require('../appSettings.js');


module.exports = function(app){
  app.post('/updatecourseprogress/:sub', function(req, res,next){
    // lookup user
    models.EcoUser.findOne({_id:req.params.sub}).exec(function (err, theUser){
        if (theUser) {
          log('post /updatecourseprogress/' + req.params.sub ,true);
          utils.updateUserAllCoursesProgress(req.params.sub)
          .fin(function(){
          res.status(200).end();
          return;              
          })
        }
    });
  });
}




