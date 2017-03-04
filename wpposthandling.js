var Q = require( "q" );
var xmlrpc=require('xmlrpc');
var url = require('url');


var appSettings = require('./appSettings.js');
var log = require('./log.js');



var urlObject=url.parse(appSettings.WPUrl);
if (!urlObject.protocol){
    urlObject.protocol='http:';
}
if (!urlObject.port){
    urlObject.port='80';
}

var xmlRpcClient = xmlrpc.createClient({ host: urlObject.hostname, port: urlObject.port, path: urlObject.path});


module.exports = {
    getWpPost:getWpPost
}




function getWpPost(postId,language){
    var deferred = Q.defer();

    getWpPostMetaWeblog(postId)
    .then(function(post){
        // get other language versions of this post
        var allPosts = getWpmlTranslations(post);
        // add this post to the list
        var thisLanguage = getWpmlLanguage(post);
        allPosts[thisLanguage]=postId;

        // get the post in the requested language, when available!
        if(!allPosts[language]){
            // post in requested language not available. take first.
            var thePostId= allPosts[thisLanguage]
        } else {
            var thePostId=allPosts[language];
        }

        if(thePostId == postId){
            result = prepareWpPost(post);
            deferred.resolve(result);
        } else {
          getWpPostMetaWeblog(allPosts[language])
          .then(function(post){
              result = prepareWpPost(post);
              deferred.resolve(result);
          })
        }
    })
    .fail(function(err){
        deferred.resolve({
            dirty: "",
            html: ""
        });
    });

    return deferred.promise;
}




// Extends the postObject from the database with extra properties to leverage processing on the client
function prepareWpPost(post){
debugger;
      var html=post.description;
      // clean html
      // remove [vc_*] [/vc_*]  tags
      html=html.replace(/((\[vc_)|(\[\/vc_)).+?(\])/ig, "");

      // replace [heading] with h2 tag
      html=html.replace(/(\[)heading\]/ig, "<h2>");
      html=html.replace(/(\[\/)heading\]/ig, "</h2>");

      // replace [divider] with hr tag
      html=html.replace(/\[divider.+\]/ig, "<hr/>");

      // remove [caption] [/caption]  tags
      html=html.replace(/((\[caption).+?\])/ig, "");
      html=html.replace(/(\[\/caption\])/ig, "");

      // replace cr/lf with br tag
      html=html.replace(/\r\n/ig, "<br/>");

      return {
        dirty: post.description,
        html: html
      };
}


function getWpPostMetaWeblog(postId){
    var deferred = Q.defer();
    // call wordpress twice, with the same parameters. Otherwise wpml fields will not always be filled :(
    xmlRpcClient.methodCall('metaWeblog.getPost', [postId, appSettings.WPUser, appSettings.WPPw], function (error, post) {
    debugger;
        if(post){
          log('metaWeblog.getPost1: postid & langauge ' + post.postid + ", " + getWpmlLanguage(post));

          setTimeout(function(){
              xmlRpcClient.methodCall('metaWeblog.getPost', [post.postid,appSettings.WPUser, appSettings.WPPw], function (error, post) {
                if(post){
                  log('metaWeblog.getPost2: postid & langauge ' + post.postid + ", " + getWpmlLanguage(post));
                  log('post'+ JSON.stringify(post));
                  deferred.resolve(post);
                }
                if(error || !post){
                    deferred.reject();
                }
              });
          },1000) // wait 1 sec for next call
        };
        if(error || !post){
            deferred.reject();
        }

    });
    return deferred.promise;
}

function getWpmlLanguage(post){
    var result=null;
    if(post.custom_fields){  // custom_fields = array of { id: key: value: }
        var cf=post.custom_fields.filter(function(o){return o.key == "_wpml_language";});
        if(cf.length >0){
            result = justLanguageCode(cf[0].value);
        }
    }
    return result;
}


function justLanguageCode(lang){
    lang=lang.replace(/((\_)|(-)).*/ig, "");
    return lang;
}

function getWpmlTranslations(post){
    // returns an object with each property indicating a language, value=post_id
    // {
    //    "en": 1234,
    //    "fr": 457
    // }

    debugger;
    var result=[];
    if(post.custom_fields){  // custom_fields = array of { id: key: value: }
        var cf= post.custom_fields.filter(function(o){return o.key == "_wpml_translations";});
        if(cf.length >0){
            result = JSON.parse(cf[0].value);
            if(Object.keys(result).length>0){
              for (p in result){
                  if(p!==justLanguageCode(p)){
                      result[justLanguageCode(p)] = result[p];
                      delete result[p];
                  }
              }
            }
        }
    }
    return result;
}
