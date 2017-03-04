var mongoose = require('mongoose');
var async=require('async');

var appSettings = require('./appSettings.js');
var log = require('./log.js');



var appSettings = require('./appSettings.js');

appSettings.mongoBackendConnection  = mongoose.createConnection('mongodb://localhost' + ':' + appSettings.mongoPort + '/' +appSettings.mongooseBackendDB );
appSettings.mongoIDPConnection     = mongoose.createConnection('mongodb://localhost' + ':' + appSettings.mongoPort + '/' +appSettings.mongooseIDPDB);

appSettings.mongoBackendConnection.on('error', console.error.bind(console, 'connection error:'));
appSettings.mongoIDPConnection.once('open', function callback (){
    log('Backend MongoDB connected');
    var models=require('./models.js');

    async.series([
       addRoleToHubContactPerson,
       updateUserRoles,
    ],
    function(err, results) {
        log('done');
    });



function addRoleToHubContactPerson(asynccallback){
    // give all hubcontactpersons the moocitoadmin role
    models.HubContactPerson.find({}).exec(function(err, hubbies){
        async.eachSeries(hubbies,
            function(hubContact, callback) {
                log("moocitoadmin role to hubContact: " + hubContact.email);
                models.UserRoles.findOne({emailcanonical:hubContact.email}).exec(function(err, theRole){
                    if(theRole){
                        if(theRole.roles.indexOf("moocitoadmin") == -1){
                            theRole.roles.push("moocitoadmin");
                        }
                    } else {
                        var theRole = new models.UserRoles();
                        theRole._user = null;  // we'll fix that later
                        theRole.emailcanonical = hubContact.email;
                        theRole.roles = ["moocitoadmin"];
                    }
                    theRole.save(function(err,r){
                        callback(null);
                    });
                })
            },
            function(err){
                asynccallback(null);
            }
        );
    });
}


function updateUserRoles(asynccallback){
    models.UserRoles.find({}).exec(function(err, roles){
        async.eachSeries(roles,
            function(theRole, callback) {
                // find user based on email
                log("syncing " + theRole.emailcanonical);
                models.EcoUser.findOne({emailcanonical:theRole.emailcanonical}).exec(function(err, theUser){
                    if(theUser){
                        theRole._user = theUser._id;
                    } else {
                        theRole._user = null;
                    }
                    theRole.save(function(err,r){
                        callback(null);
                    });
                });
            },
            function(err){
                asynccallback(null);
            }
        );
    });
}




});



