var appSettings = require('./appSettings.js');

module.exports = function (message,showInProd){
    if(appSettings.environment!=='PROD' ||showInProd){
      var message = (new Date()).toJSON() + ": " + message|| '';
      //console.log.apply(undefined,arguments);
      console.log(message);
    }
}