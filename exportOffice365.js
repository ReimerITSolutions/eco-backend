var moment=require("moment");
var fs=require("fs");
var mongoose = require('mongoose');
var fs = require('fs');
var async = require('async');

var appSettings = require('./appSettings.js');
var log = require('./log.js');

function exportOffice365Accounts(){
    models.Office365AccountRequest.find({exportedOn:null}).exec(function(err,accounts){
    log(err);
    log(accounts.length);
        if(!err && accounts.length>0){
            log('To do:' + accounts.length,true);
            var fileName = defineOfficeCSVName();
            log(fileName);
            var counter=1 ;
            log(counter);

            var emailFileName = defineEmailCSVName()

            addOfficeCSVHeader(appSettings.office365AccountExportLocation + '/' + fileName);
            addEmailCSVHeader(appSettings.office365AccountExportLocation + '/' + emailFileName);

            async.mapSeries(accounts,
                function(Office365AccountRequest, callback){
                    addOfficeCSVRecord(appSettings.office365AccountExportLocation + '/' + fileName, Office365AccountRequest.userPrincipalName, Office365AccountRequest.language);
                    addEmailCSVRecord(appSettings.office365AccountExportLocation + '/' + emailFileName, Office365AccountRequest.ecoEmail,Office365AccountRequest.language);
                    Office365AccountRequest.exportedOn =  new Date();
                    Office365AccountRequest.exportFilename = fileName;

                    Office365AccountRequest.save(function(err,Office365AccountRequest){
                        counter++;
                        log(counter);
                        if(counter>200){
                            fileName = defineOfficeCSVName();
                            emailFileName = defineEmailCSVName();
                            log(fileName);
                            counter=1
                            addOfficeCSVHeader(appSettings.office365AccountExportLocation + '/' + fileName);
                            addEmailCSVHeader(appSettings.office365AccountExportLocation + '/' + emailFileName);
                        }

                        callback(null);
                    });
                },
                function(err, results){
                    log('Finished!',true);
                    mongoose.disconnect();
                    process.exit(code=0);
                }
            );

        } else {
            log('Finished!',true);
            mongoose.disconnect();
        }
    });
}


function defineOfficeCSVName(){
    var name = "office365accounts-" + moment().format("YYYY-MM-DD");
    var sequence = 1;
    var fileName = name + "_" + sequence + ".txt";

    while (fileExists(appSettings.office365AccountExportLocation + '/' + fileName)){
        sequence++;
        fileName = name + "_" + sequence + ".txt";
    }
    return fileName;
}

function defineEmailCSVName(){
    var name = "office365accountsUserEmails-" + moment().format("YYYY-MM-DD");
    var sequence = 1;
    var fileName = name + "_" + sequence + ".txt";

    while (fileExists(appSettings.office365AccountExportLocation + '/' + fileName)){
        sequence++;
        fileName = name + "_" + sequence + ".txt";
    }
    return fileName;
}


function fileExists(filePath){
    var result = false;
    try {
        var stats=fs.statSync(filePath);
        result=true;
    } catch(e){
        result = false;
    }
    return result;
}

function addOfficeCSVRecord(fileName, userPrincipalName,language){
    var line = userPrincipalName +"@participants.ecolearning.eu" + "," + userPrincipalName + "," + "Ecolearning" + "," + userPrincipalName  + " Ecolearning" + ","+ translateLocationCode(language) +","  + "UNED229:STANDARDWOFFPACK_IW_FACULTY" + "," + "hTsRej3g" + "," + translateLangCode(language) + "\r\n";
    fs.appendFileSync(fileName,line, {encoding:'utf8'});
}

function addEmailCSVRecord(fileName, email, language){
    var line = email + "," + language + "\r\n";
    fs.appendFileSync(fileName,line, {encoding:'utf8'});
}

function addOfficeCSVHeader(fileName){
    var line = "UserPrincipalName,FirstName,LastName,DisplayName,UsageLocation,AccountSkuId,Password,PreferredLanguage" + "\r\n";
    fs.appendFileSync(fileName,line, {encoding:'utf8'});
}

function addEmailCSVHeader(fileName){
    var line = "email,language" + "\r\n";
    fs.appendFileSync(fileName,line, {encoding:'utf8'});
}



function translateLangCode(lang){
    lang=lang.toLowerCase();
    if(lang=='en'){
        return 'en-US';
    }
    if(lang=='es'){
        return 'es-ES';
    }
    if(lang=='pt'){
        return 'pt-PT';
    }
    if(lang=='it'){
        return 'it-IT';
    }
    if(lang=='de'){
        return 'de-DE';
    }
    if(lang=='fr'){
        return 'fr-FR';
    }
    return 'en-US';
}

function translateLocationCode(lang){
    lang=lang.toLowerCase();
    if(lang=='en'){
        return 'US';
    }
    if(lang=='es'){
        return 'ES';
    }
    if(lang=='pt'){
        return 'PT';
    }
    if(lang=='it'){
        return 'IT';
    }
    if(lang=='de'){
        return 'DE';
    }
    if(lang=='fr'){
        return 'FR';
    }
    return 'US';
}


appSettings.mongoBackendConnection  = mongoose.createConnection('mongodb://'+ appSettings.mongoBackendDBUser + ":" + appSettings.mongoBackendDBPassword + '@' + appSettings.mongoHost + ':' + appSettings.mongoPort + '/' +appSettings.mongooseBackendDB);
appSettings.mongoIDPConnection = mongoose.createConnection('mongodb://'+ appSettings.mongoIDPDBUser + ":" + appSettings.mongoIDPDBPassword + '@' + appSettings.mongoHost + ':' + appSettings.mongoPort + '/' +appSettings.mongooseIDPDB);

appSettings.mongoBackendConnection.on('error', console.error.bind(console, 'connection error:'));
appSettings.mongoIDPConnection.once('open', function callback (){
    log('MongoDB connected',true);
    models=require("./models.js");
    utils=require('./utils.js');

    exportOffice365Accounts();

});




