var mongoose = require('mongoose');
var appSettings = require('./appSettings.js');

var rssFeedSchema = new mongoose.Schema({
 url : String,
 language : String,
});

var languageStringSchema = new mongoose.Schema({
 language : String,
 string : String,
});

var teacherSchema = new mongoose.Schema({
 id : String,
 name : String,
});

var courseSchema = new mongoose.Schema({
    _platform: {type: mongoose.Schema.Types.ObjectId, ref: 'platforms'},
    oaiPmhIdentifier: String,
    deleted: Boolean,
    identifier :{
       catalog : String,
       entry : String,
    },
    title: [languageStringSchema],
    description:[languageStringSchema],
    language:[String],
    teachers:[teacherSchema],
    startDate: Date,
    endDate: Date,
    nrOfUnits : Number,
    interestArea:String,
    courseUrl:String,
    typicalLearningTime:String,
    submissionTimstamp: Date,
    organizers:[String],
    studyLoad: Number,
    courseGroup: String,
    courseImageName:String,
    priority: { type: Number, default: 0 },
    lastModificationTimestamp: Date,
    courseHash: String,
    spotlight: { type: Boolean, default: false },
});

var rssArticleSchema = new mongoose.Schema({
    guid: String,
    language : String,
    title: String,
    link: String,
    pubDate: Date,
    creator: String,
    category: String,
    description: String,
});

var courseTeacherSchema = new mongoose.Schema({
    localId: String,
    platformId: {type: mongoose.Schema.Types.ObjectId},
    name: String,
    imageName: String,
    description:[languageStringSchema],
});


var appInstanceSchema = new mongoose.Schema({
    appType: String,
    lastIp: String,
    lastConnected: Date,
    users: [mongoose.Schema.Types.ObjectId]
});

var singleTranslationSchema = new mongoose.Schema({
 language : String,
 text : String,
});

var translationSchema = new mongoose.Schema({
    id: Number,
    translations:[singleTranslationSchema]
});

var MOOCPlatformSchema = new mongoose.Schema({
    name: String,
    oaiPmhUrl: String,
    doHarvest: Boolean,
    RESTApiUrl: String,
    logoName:String,
    organizers: [String],
    userCatchAllUrl: String,
    userCatchAllTranslations:[languageStringSchema],
});


var xApiQueueSchema = new mongoose.Schema({
    recievedTimestamp: Date,
    committedTimestamp: Date,
    UUID:String,
    idpClient:mongoose.Schema.Types.ObjectId,
    actor: mongoose.Schema.Types.Mixed,
    verb: mongoose.Schema.Types.Mixed,
    object: mongoose.Schema.Types.Mixed,
    context: mongoose.Schema.Types.Mixed,
    xApiStatement: String,
});


var OpenIDClientSchema = new mongoose.Schema({
    name: String,
    key: {
            type: String,
            index: true
    },
    secret: String,
    redirect_uri: String,
    redirect_httpcode : Boolean,
    public_AppName:String,
    legal_terms_url:String,
    privacy_policy_url:String,
    afterRegisterUrl:String,
    client_authentication_method:String,
    defaultClientUrl:String,
});

var userCourseProgressSchema = new mongoose.Schema({
    _user : {
            type: mongoose.Schema.Types.ObjectId,
            index: true
    },
    _platform : {
            type: mongoose.Schema.Types.ObjectId,
            index: true
    },
    coursesProgress : mongoose.Schema.Types.Mixed,
    lastUpdated: Date,
});

var submittedFormSchema = new mongoose.Schema({
    _user : {
            type: mongoose.Schema.Types.ObjectId,
            index: true
    },
    formId : {
            type: Number,
            index: true
    },
    formContent : mongoose.Schema.Types.Mixed,
    recievedTimestamp: Date
});

var userSchema = new mongoose.Schema({
    given_name: String,
    middle_name: String,
    family_name: String,
    nickname: String,
    email: {
            type: String,
            index: true
    },
    email_verified: Boolean,
    password: String,
    tempPassword:String,
    birthdate: Date,
    gender: String,
    language: String,
    postal_code: String,
    locality: String, //city
    country: String,  // 2 Letter ISO 3166-1 code
    interests:String,
    loggedIn: Boolean,
    stayLoggedIn: Boolean,
    confirmed:Boolean,
    registeredOn: Date,
    lastLoggedIn: Date,
    uniqueUserName: String,
    updated_at: Number, // Time the End-User's information was last updated. Its value is a JSON number representing the number of seconds from 1970-01-01T0:0:0Z as measured in UTC until the date/time.
    website: String,  // URL
    twitterUrl: String, // URL
    facebookUrl : String, // URL
    linkedInUrl: String, // URL
    bio:String, // Plaint text,no html, only <br/> allowed for new lines
    emailcanonical: {
            type: String,
            index: true
    },
},
{
  toObject: {
  virtuals: true
  },
  toJSON: {
  virtuals: true
  }
}
);

userSchema.virtual('name').get(function () {
  return (this.given_name ||'') + ((this.given_name|| '')!==''?' ':'') + (this.middle_name ||'') + ((this.middle_name|| '')!==''?' ':'') + (this.family_name ||'');
});

userSchema.virtual('preferred_username').get(function () {
  return (this.email||'');
});


var courseStatisticsSchema = new mongoose.Schema({
    _course : {
            type: mongoose.Schema.Types.ObjectId,
            index: true,
            ref: 'courses'
    },
    countUsersEn: { type: Number, default: 0 },
    countUsersFr: { type: Number, default: 0 },
    countUsersPt: { type: Number, default: 0 },
    countUsersDe: { type: Number, default: 0 },
    countUsersIt: { type: Number, default: 0 },
    countUsersEs: { type: Number, default: 0 }

});
courseStatisticsSchema.virtual('totalUsers').get(function () {
  return (this.countUsersEn + this.countUsersFr + this.countUsersPt + this.countUsersDe + this.countUsersIt + this.countUsersEs);
});


var moocProposalSchema = new mongoose.Schema({
    _user : {
            type: mongoose.Schema.Types.ObjectId,
            index: true
    },
    nr: Number,
    teacherTeachesAtEducationalLevel:String,
    teachercompletedMoocs:[String],
    teacherTeachesWhat:String,
    proposedMoocTopic:String,
    proposedMoocLearningObjectives:String,
    proposedMoocDescription:String,
    proposedMoocRecommendedRequirements:String,
    proposedMoocResources:[String],
    proposedMoocCoTeachers:String,
    proposedMoocOtherComments:String,
    proposedMoocTargetAudience:String,
    teacherIsTeacher:Boolean,
    tentativeMoocTitle:String,
    proposedMoocCategory:String,
    moocOfferedBefore:Boolean,
    proposedMoocEducationalLevel:String,
    proposedMoocLanguages:[String],
    status: Number,
    notes:String,
    assignedHub:String,
    assignedHubContact:String,
});

var interestedETeacherSchema = new mongoose.Schema({
    _user : {
            type: mongoose.Schema.Types.ObjectId,
            index: true
    },
    nr: Number,
    teacherTeachesAtEducationalLevel:String,
    teachercompletedMoocs:[String],
    teacherTeachesWhat:String,
    teacherIsTeacher:Boolean,
    status: Number,
    notes:String,
    assignedHub:String,
    assignedHubContact:String,
});

var moocSpaceSchema = new mongoose.Schema({
    status: Number,
    name:{ type: String, default: '' },
    mainContact:{ type: String, default: '' },
    category:{ type: String, default: '' },
    hub:{ type: String, default: '' },
    start: Date,
    end:Date,
    language:{ type: [String], default: 'EN' },
    readyInOpenMooc:{ type: Boolean, default: false },
    published:{ type: Boolean, default: false },
    notes:String,
    appformnr:Number,
});



var hubContactPersonSchema = new mongoose.Schema({
    email:String,
    hub:String,
});


var userRolesSchema = new mongoose.Schema({
    _user: {type: mongoose.Schema.Types.ObjectId, ref: 'users', index:true},
    emailcanonical: String,
    roles: [String],
});


var rolesSchema = new mongoose.Schema({
    role: String,
});


var accessTokenSchema = new mongoose.Schema({
    token: String,
    _user: {type: mongoose.Schema.Types.ObjectId, ref: 'users', index:true},
    _client: mongoose.Schema.Types.ObjectId,
    expiresIn: Number,
    createdOn: Date,
    scope: String,
});

var advertisementSchema= new mongoose.Schema({
    showStart: Date,
    showEnd: Date,
    name: String,
    advertisementNr : {
            type: Number,
            index: true
    },
    translationId: Number,
    wpPostId: Number,
    active: Boolean,
    forcePopup:Boolean,
});

var advertisementsPerUserSchema= new mongoose.Schema({
    _user : {
            type: mongoose.Schema.Types.ObjectId,
            index: true
    },
    advertisementNr : {
            type: Number,
            index: true,
    },
    shownOn: [Date],
    showPopup: Boolean,
});

var office365AccountRequestSchema= new mongoose.Schema({
    _user : {
            type: mongoose.Schema.Types.ObjectId,
            index: true
    },
    userPrincipalName: String,
    ecoEmail: String,
    language: String,
    submittedOn: Date,
    exportedOn:Date,
    exportFilename: String,
    userRegisteredOn: Date,
});


var oaiPMHMetaDataSchema = new mongoose.Schema({
    _course: {type: mongoose.Schema.Types.ObjectId, ref: 'courses'},
    lastModificationTimestamp: Date,
    courseHash: String,
    oaiPmhIdentifier: String,
    deleted: Boolean,
    identifier :{
       catalog : String,
       entry : String,
    },
    title: [languageStringSchema],
    description:[languageStringSchema],
    language:[String],
    teachers:[teacherSchema],
    startDate: Date,
    endDate: Date,
    nrOfUnits : Number,
    interestArea:String,
    courseUrl:String,
    typicalLearningTime:String,
    organizers:[String],
    studyLoad: Number,
    courseGroup: String,
    courseImageName:String,
});



var EcoCourse = appSettings.mongoBackendConnection.model('courses', courseSchema);
var rssArticle = appSettings.mongoBackendConnection.model('rssarticles', rssArticleSchema);
var appInstance = appSettings.mongoBackendConnection.model('appinstances', appInstanceSchema);
var moocPlatform = appSettings.mongoBackendConnection.model('platforms', MOOCPlatformSchema);
var EcoTeacher = appSettings.mongoBackendConnection.model('teachers', courseTeacherSchema);
var Translation = appSettings.mongoBackendConnection.model('translations', translationSchema);
var rssFeed = appSettings.mongoBackendConnection.model('rssfeeds', rssFeedSchema);
var XapiQueue = appSettings.mongoBackendConnection.model('xapiqueues', xApiQueueSchema);
var OpenIDClient = appSettings.mongoIDPConnection.model('openidclients', OpenIDClientSchema);
var UserCourseProgress = appSettings.mongoBackendConnection.model('courseprogresses', userCourseProgressSchema);
var SubmittedForm = appSettings.mongoBackendConnection.model('submittedforms', submittedFormSchema);
var EcoUser = appSettings.mongoIDPConnection.model('users', userSchema);
var courseStatistics = appSettings.mongoBackendConnection.model('coursestatistics', courseStatisticsSchema);
var UserRoles = appSettings.mongoIDPConnection.model('userroles', userRolesSchema);
var Roles = appSettings.mongoIDPConnection.model('roles', rolesSchema);
var AccessToken = appSettings.mongoIDPConnection.model('AccessTokens', accessTokenSchema);
var HubContactPerson = appSettings.mongoBackendConnection.model('hubcontactpersons', hubContactPersonSchema);
var MoocProposal = appSettings.mongoBackendConnection.model('moocproposals', moocProposalSchema);
var InterestedETeacher = appSettings.mongoBackendConnection.model('interestedeteachers', interestedETeacherSchema);
var MoocSpace = appSettings.mongoBackendConnection.model('moocspaces', moocSpaceSchema);
var Advertisement = appSettings.mongoBackendConnection.model('advertisements', advertisementSchema);
var AdvertisementsPerUser = appSettings.mongoBackendConnection.model('advertisementsperuser', advertisementsPerUserSchema);
var Office365AccountRequest = appSettings.mongoBackendConnection.model('office365accountrequest', office365AccountRequestSchema);


module.exports = {
    EcoCourse:EcoCourse,
    rssArticle:rssArticle,
    appInstance:appInstance,
    moocPlatform:moocPlatform,
    EcoTeacher:EcoTeacher,
    Translation:Translation,
    rssFeed:rssFeed,
    XapiQueue:XapiQueue,
    AccessToken:AccessToken,
    OpenIDClient:OpenIDClient,
    UserCourseProgress:UserCourseProgress,
    SubmittedForm:SubmittedForm,
    EcoUser:EcoUser,
    courseStatistics: courseStatistics,
    UserRoles:UserRoles,
    Roles:Roles,
    EcoUser:EcoUser,
    HubContactPerson:HubContactPerson,
    MoocProposal:MoocProposal,
    InterestedETeacher:InterestedETeacher,
    MoocSpace:MoocSpace,
    Advertisement:Advertisement,
    AdvertisementsPerUser:AdvertisementsPerUser,
    Office365AccountRequest:Office365AccountRequest,
}
