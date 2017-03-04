module.exports = function(app){
  var url = require('url');
  var log = require('./log.js');
  var apiResult = {
              code:'200',
              message:'OK'
  };


  // Error object is extended with these properties:
  // - idp_error
  // - status, in case of 404
  // - sendpostresponse

  // handling 404 errors
  app.use(function(err, req, res, next) {
    if(err.status && err.status == 404) {
          apiResult.code= '404',
          apiResult.message='Not Found'
          res.status(apiResult.code).json(apiResult);
          log('404 not found',true);
          return;
    } else {
      return next(err);
    }
  });

  app.use(function(err, req, res, next) {
    log('Error occurred!:' + err,true);

    if(!err.message){
        err.message = 'An internal server error occurred.';
    }

    apiResult.code= '500',
    apiResult.message='Server Error: ' + err;
    res.status(apiResult.code).json(apiResult);
  });



}


