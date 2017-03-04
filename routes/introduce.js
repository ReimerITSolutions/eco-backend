var log = require('../log.js');
var errorHandle=require('../errorHandle.js');
var models=require('../models.js');


module.exports = function(app){
  // Generate a new appInstance record and return its _id.
  app.put('/introduce', function(req, res,next){
      var apiResult = {
        code:'200',
        message:'OK'
      };

      var appType='unknown';
      try{
        appType=req.query.type;
      } catch(e){}

      var appInstanceId=null;
      try{
        appInstanceId=req.query.aik;
      } catch(e){}

      models.appInstance.findOne({_id:appInstanceId}).exec(function(err,theAppInstance){
        if(err || !theAppInstance){
          var theAppInstance =new models.appInstance({
            lastIp:req.headers['x-forwarded-for'] || req.connection.remoteAddress,
            lastConnected:new Date(),
            appType:appType
          });
        } else {
            theAppInstance.lastConnected=new Date();
            theAppInstance.lastIp = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
        }

        theAppInstance.save(function (err, theAppInstance){
          if (err) {
              log('Error saving AppInstance. Error: ' + JSON.stringify(err));
              error = new Error('Error saving userdata.');
              res.json(-1); // must return something 
          } else {
            res.json(theAppInstance._id);
            log('/put introduce: AppInstance ' + theAppInstance._id + ' created');
          }
        });


      });



  });


}





