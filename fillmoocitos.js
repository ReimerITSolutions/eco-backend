var mongoose = require('mongoose');
var url = require('url');
var sanitizeHtml = require('sanitize-html');
var https = require('https');
var http = require('http');
var EventEmitter = require('events').EventEmitter;
var util = require('util');

var appSettings = require('./appSettings.js');
var log = require('./log.js');




appSettings.mongoIDPConnection     = mongoose.createConnection('mongodb://localhost' + ':' + appSettings.mongoPort + '/' +appSettings.mongooseIDPDB);
appSettings.mongoBackendConnection  = mongoose.createConnection('mongodb://localhost' + ':' + appSettings.mongoPort + '/' +appSettings.mongooseBackendDB );
appSettings.mongoBackendConnection.on('error', console.error.bind(console, 'connection error:'));
appSettings.mongoBackendConnection.once('open', function callback (){
    log('Backend MongoDB connected',true);
    utils = require('./utils.js');
    models=require('./models.js');
    start();
});

function start(){
  models.SubmittedForm.find({}).exec(function (err, forms){
    for(var i =0;i<forms.length;i++){
        var form=forms[i];
        if(form.formContent.JoinExistingGroupOrCreateNewMooc === "create"){
            addMoocProposal2(form,i+271);
        } else {
            addMoocinterestedETeacher(form,i);
        }
    }
    console.log('done');
  });


}


function addMoocProposal(SubmittedForm,i) {
    var MoocProposal = new models.MoocProposal;
    MoocProposal._user = SubmittedForm._user;
    MoocProposal.nr = i+1;

    MoocProposal.teacherTeachesAtEducationalLevel = SubmittedForm.formContent.AtWhatEducationalLevelDoYouTeach;
    MoocProposal.teacherTeachesWhat = SubmittedForm.formContent.WhatDoYouTeach;
    MoocProposal.teachercompletedMoocs = SubmittedForm.formContent.WhichAreYourCompletedMoocs;
    MoocProposal.proposedMoocTopic = SubmittedForm.formContent.YourMoocTopic;
    MoocProposal.teacherIsTeacher = (SubmittedForm.formContent.AreYouATeacher=='yes');
    MoocProposal.tentativeMoocTitle = SubmittedForm.formContent.YourTentativeMoocTitle;
    MoocProposal.proposedMoocCategory = SubmittedForm.formContent.YourMoocCategory;
    MoocProposal.proposedMoocEducationalLevel = SubmittedForm.formContent.YourMoocEducationalLevel;
    MoocProposal.proposedMoocLanguages = SubmittedForm.formContent.YourMoocLanguages;
    MoocProposal.status=99
    MoocProposal.notes = "";
    MoocProposal.assignedHub = "";
    MoocProposal.assignedHubContact=""

    MoocProposal.save();
}

function addMoocProposal2(SubmittedForm,i) {
    var MoocProposal = new models.MoocProposal;
    MoocProposal._user = SubmittedForm._user;
    MoocProposal.nr = i+1;

    MoocProposal.teacherTeachesAtEducationalLevel = SubmittedForm.formContent.AtWhatEducationalLevelDoYouTeach;
    MoocProposal.teacherTeachesWhat = SubmittedForm.formContent.WhatDoYouTeach;
    MoocProposal.teachercompletedMoocs = SubmittedForm.formContent.WhichAreYourCompletedMoocs;
    MoocProposal.teacherIsTeacher = (SubmittedForm.formContent.AreYouATeacher=='yes');

    MoocProposal.proposedMoocCategory = SubmittedForm.formContent.YourMoocCategory;
    MoocProposal.tentativeMoocTitle = SubmittedForm.formContent.YourTentativeMoocTitle;
    MoocProposal.proposedMoocTopic = SubmittedForm.formContent.YourMoocTopic;
    MoocProposal.proposedMoocLanguages = SubmittedForm.formContent.YourMoocLanguages;
    MoocProposal.proposedMoocLearningObjectives =  SubmittedForm.formContent.LearningObjectives;
    MoocProposal.proposedMoocDescription =  SubmittedForm.formContent.ShortDescription;
    MoocProposal.proposedMoocRecommendedRequirements =  SubmittedForm.formContent.RecommendedRequirements;
    MoocProposal.proposedMoocTargetAudience =  SubmittedForm.formContent.TargetAudience;
    MoocProposal.proposedMoocResources =  SubmittedForm.formContent.Resources;
    MoocProposal.proposedMoocCoTeachers =  SubmittedForm.formContent.CoTeachers;
    MoocProposal.proposedMoocOtherComments =  SubmittedForm.formContent.OtherComments;
    MoocProposal.moocOfferedBefore =   (SubmittedForm.formContent.MoocOfferedBeforeYesNo=='yes');
    MoocProposal.proposedMoocEducationalLevel = SubmittedForm.formContent.YourMoocEducationalLevel;

    MoocProposal.status=1
    MoocProposal.notes = "";
    MoocProposal.assignedHub = "";
    MoocProposal.assignedHubContact=""

    MoocProposal.save();
}


function addMoocinterestedETeacher(SubmittedForm,i) {
    var InterestedETeacher = new models.InterestedETeacher;
    InterestedETeacher._user = SubmittedForm._user;
    InterestedETeacher.nr = i+1;

    InterestedETeacher.teacherTeachesAtEducationalLevel = SubmittedForm.formContent.AtWhatEducationalLevelDoYouTeach;
    InterestedETeacher.teacherTeachesWhat = SubmittedForm.formContent.WhatDoYouTeach;
    InterestedETeacher.teachercompletedMoocs = SubmittedForm.formContent.WhichAreYourCompletedMoocs;
    InterestedETeacher.teacherIsTeacher = (SubmittedForm.formContent.AreYouATeacher=='yes');

    InterestedETeacher.status=1
    InterestedETeacher.notes = "";
    InterestedETeacher.assignedHub = "";
    InterestedETeacher.assignedHubContact=""

    InterestedETeacher.save();
}
