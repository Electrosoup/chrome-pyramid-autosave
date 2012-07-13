'use strict';

var TRUE = 'true';
var FALSE = 'false';

localStorage.ROUTE_SCHEMA = 'id,match,savePath';
localStorage.SERVER_SCHEMA = 'id,url';

var souptools = {};

(function(tools) {

    var tag2attr = {
        a       : 'href',
        img     : 'src',
        form    : 'action',
        base    : 'href',
        script  : 'src',
        iframe  : 'src',
        link    : 'href'
    },

    key = ["source","protocol","authority","userInfo","user","password","host","port","relative","path","directory","file","query","fragment"], // keys available to query

    aliases = { "anchor" : "fragment" }, // aliases for backwards compatability

    parser = {
        strict  : /^(?:([^:\/?#]+):)?(?:\/\/((?:(([^:@]*):?([^:@]*))?@)?([^:\/?#]*)(?::(\d*))?))?((((?:[^?#\/]*\/)*)([^?#]*))(?:\?([^#]*))?(?:#(.*))?)/,  //less intuitive, more accurate to the specs
        loose   :  /^(?:(?![^:@]+:[^:@\/]*@)([^:\/?#.]+):)?(?:\/\/)?((?:(([^:@]*):?([^:@]*))?@)?([^:\/?#]*)(?::(\d*))?)(((\/(?:[^?#](?![^?#\/]*\.[^?#\/.]+(?:[?#]|$)))*\/?)?([^?#\/]*))(?:\?([^#]*))?(?:#(.*))?)/ // more intuitive, fails on relative paths and deviates from specs
    },

    querystring_parser = /(?:^|&|;)([^&=;]*)=?([^&;]*)/g, // supports both ampersand and semicolon-delimted query string key/value pairs

    fragment_parser = /(?:^|&|;)([^&=;]*)=?([^&;]*)/g; // supports both ampersand and semicolon-delimted fragment key/value pairs

    tools.parseUri = function(url, strictMode)
    {
        var str = decodeURI( url ),
            res   = parser[ strictMode || false ? "strict" : "loose" ].exec( str ),
            uri = { attr : {}, param : {}, seg : {} },
            i   = 14;

        while ( i-- )
        {
            uri.attr[ key[i] ] = res[i] || "";
        }

        // build query and fragment parameters

        uri.param['query'] = {};
        uri.param['fragment'] = {};

        uri.attr['query'].replace( querystring_parser, function ( $0, $1, $2 ){
            if ($1)
            {
                uri.param['query'][$1] = $2;
            }
        });

        uri.attr['fragment'].replace( fragment_parser, function ( $0, $1, $2 ){
            if ($1)
            {
                uri.param['fragment'][$1] = $2;
            }
        });

        // split path and fragement into segments

        uri.seg['path'] = uri.attr.path.replace(/^\/+|\/+$/g,'').split('/');

        uri.seg['fragment'] = uri.attr.fragment.replace(/^\/+|\/+$/g,'').split('/');

        // compile a 'base' domain attribute

        uri.attr['base'] = uri.attr.host ? uri.attr.protocol+"://"+uri.attr.host + (uri.attr.port ? ":"+uri.attr.port : '') : '';

        return uri;
    };
})(souptools);

/**
 * @param {number} major
 * @param {number} minor
 * @nosideeffects
 * @return {Object}
 */
function versionPair(major, minor) {
    return {
        major: parseInt(major),
        minor: parseInt(minor),
        toString: function() {
            return this.major + '.' + this.minor;
        }
    };
}

function get_remote_call(url) {

    var uri = souptools.parseUri(url, true);

    if (uri.attr.authority === 'chrome') {

        return;
    }

    var server = uri['attr']['base'];

    server += '/__rocker_ping';

    return server

}


var protocolVersion = versionPair(1, 0);

function pingRocker(tabId, changeInfo, tab) {

    chrome.browserAction.setIcon({path:'icon_inactive_19.png'});

    window.localStorage.setItem('editable',FALSE)

    chrome.browserAction.setBadgeText({text:''});

    var server = get_remote_call(tab.url);

    var request = new XMLHttpRequest();

    request.onreadystatechange = function (){

        if (request.readyState == 4) {

            if(request.status === 0) {

                return;

            } else if(request.status == 404) {

                return;

            } else if(request.status == 200) {

                chrome.browserAction.setIcon({path:'icon_19.png'});

                window.localStorage.setItem('editable',TRUE);

                if (window.localStorage.getItem('record') == TRUE) {

                    chrome.browserAction.setBadgeText({text:'REC'});

                }

                else {

                    chrome.browserAction.setBadgeText({text:''});

                }

                return;

            }

        }

    };

    function onError(event) {
        return null;
    }

    request.onload = function(event) {
        if (onError(event)) {
            return;
        }
    };

    request.onerror = onError;

    request.open('GET', server, true);

    try {
        request.send();
    }

    catch (e) {
        console.log('boo');
        return;
    }
}


function toggleRecord(info) {

    if (window.localStorage.getItem('editable') == FALSE) {

        chrome.browserAction.setBadgeText({text:''});

        return;
    }

    if (window.localStorage.getItem('record') == FALSE) {

        chrome.browserAction.setBadgeText({text:'REC'});

        window.localStorage.setItem('record', TRUE);

    }

    else {

        chrome.browserAction.setBadgeText({text:''});

        window.localStorage.setItem('record', FALSE);

    }

}

function sendToBackend(request) {

    var xhrHandshake = new XMLHttpRequest();

    var server = get_remote_call(request.url);

    xhrHandshake.open('GET', server, true);

    xhrHandshake.onload = function(event) {

        var xhr = new XMLHttpRequest();

        xhr.open('POST', server, true);

        xhr.setRequestHeader('x-autosave-version', '0.1');

        var headers = request.headers;

        for (var key in headers) {

            xhr.setRequestHeader(key, headers[key]);

        }

        xhr.send(request.content);

    };

    xhrHandshake.send(null);
}

/**
 * @param {Object} request
 * @param {MessageSender} sender
 * @param {Function} sendResponse
 */
function onRequest(request, sender, sendResponse) {

    if (request.method == 'getBackend') {

        sendResponse(request);

    } else if (request.method == 'send') {

        sendToBackend(request);

    }

}

window.localStorage.setItem('record', FALSE);

window.localStorage.setItem('editable', FALSE);

chrome.browserAction.setIcon({path:'icon_inactive_19.png'});

chrome.extension.onRequest.addListener(onRequest);

chrome.extension.onRequestExternal.addListener(onRequest);

chrome.tabs.onUpdated.addListener(pingRocker);

chrome.tabs.onActivated.addListener(function(info) {

    chrome.tabs.get(info.tabId, function(tabId) {

        pingRocker(tabId.id, null, tabId);

    });

});

chrome.browserAction.onClicked.addListener(toggleRecord);
