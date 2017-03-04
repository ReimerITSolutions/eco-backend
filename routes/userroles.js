var log = require('../log.js');
var errorHandle=require('../errorHandle.js');
var models=require('../models.js');
var utils=require('../utils.js');

module.exports = function(app){
    var apiResult = {
        code:'200',
        message:'OK'
    };

    app.get('/userroles', utils.checkAuth, function(req, res,next){
    log('GET /userroles');

    var sub = req.query.sub || '';
    // the supplied sub must equal to user._id
    if( sub !== req.accessToken._user._id.toHexString()){
          apiResult.code= '401',
          apiResult.message='Unauthorized'
          res.status(apiResult.code).json(apiResult);
          return;
    }

    var roles= '';

    models.UserRoles.findOne({_user: sub}).lean().exec(function(err, theUserRoles){
        if (!err && theUserRoles){
            roles= theUserRoles.roles.join() || '';
        }
        res.send(roles);
    });


});

}

