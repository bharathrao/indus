/**
 * @package JFBConnect
 * @copyright (C) 2009-2014 by Source Coast - All rights reserved
 * @website http://www.sourcecoast.com/
 * @website http://www.sourcecoast.com/joomla-facebook/
 * @license http://www.gnu.org/licenses/gpl-2.0.html GNU/GPL
 */

/**
 * Ensure global _gaq Google Anlaytics queue has be initialized.
 * @type {Array}
 */
;
var _gaq = _gaq || [];

var jfbc = {
    base: null,
    return_url: null,
    token: 't', // have a default, but this should be filled in
    login: {
        show_modal: false,
        scope: null, // Permissions JFBConnect requests
        logout_facebook: false,
        logged_in: true,
        login_started: false, // Prevents multiple concurrent login attempts, mainly caused by the auto-login feature enabled
        use_popup: true,

        provider: function (name)
        {
            if ((name == 'facebook') && jfbc.login.use_popup)
            {
                jfbc.debug.log('using popup' + jfbc.login.use_popup);
                jfbc.login.facebook();
            }
            else
                self.location = jfbc.base + 'index.php?option=com_jfbconnect&task=authenticate.login&provider=' + name + '&return=' + jfbc.return_url + '&' + jfbc.token + '=1';
        },

        // Special method for Facebook. Should not be called directly in case it changes. Use jfbc.login.provider('facebook') instead
        facebook: function ()
        {
            FB.login(function (response)
            {
                if (!jfbc.login.logged_in)
                    jfbc.login.facebook_onlogin();
                else
                    jfbc.permissions.fetch();
            }, {
                scope: jfbc.login.scope
            });
        },

        // v5.2 - Move to jfbc.login.provider(xyz)
        google: function ()
        {
            jfbc.login.provider('google');
        },

        // Deprecated. Use jfbc.login.login_custom();
        login_custom: function ()
        {
            jfbc.debug.log("jfbc.login.login_custom is deprecated. Please use jfbc.login.provider('facebook') instead");
            jfbc.login.provider('facebook');

        },

        // Action to perform after authentication on FB has occurred
        facebook_onlogin: function ()
        {
            if (!jfbc.login.login_started)
            {
                jfbc.login.login_started = true;
                FB.getLoginStatus(function (response)
                {
                    if (response.status === 'connected')
                    {
                        jfbcJQuery(document).one("jfbc-permissions-fetched", function ()
                        {
                            jfbc.debug.log("Login checks");
//                            if (jfbc.permissions.check('email'))
//                            {
                                jfbc.debug.log("Logging in");
                                if (jfbc.login.show_modal == '1')
                                {
                                    // First, hide the SCLogin modal if it's there
                                    jfbcJQuery('#login-modal').modal('hide');
                                    jfbcJQuery("#jfbcLoginModal").css({"margin-left": function ()
                                    {
                                        return -(jfbcJQuery("#jfbcLoginModal").width() / 2)
                                    }});
                                    jfbcJQuery("#jfbcLoginModal").modal();
                                }
                                self.location = jfbc.base + 'index.php?option=com_jfbconnect&task=authenticate.login&provider=facebook&return=' + jfbc.return_url + '&' + jfbc.token + '=1';
//                            }
                            jfbc.debug.log("Done with checks");
                        });
                        // Start the check_permissions asynchronous check. This will fire the code above.
                        jfbc.permissions.fetch();
                    }
                });
            }
            jfbc.login.login_started = false;
        },

        logout_button_click: function ()
        {
            if (jfbc.login.logout_facebook)
            {
                FB.getLoginStatus(function (response)
                {
                    if (response.status === 'connected')
                    {
                        FB.logout(function (response)
                        {
                            jfbcJQuery(document).trigger("jfbc-provider-logout-done");
                        });
                    }
                    else
                    {
                        jfbcJQuery(document).trigger("jfbc-provider-logout-done");
                    }
                });
            }
            else
            {
                jfbcJQuery(document).trigger("jfbc-provider-logout-done");
            }
        },
        logout: function (redirect)
        {
            jfbcJQuery(document).one("jfbc-provider-logout-done", function ()
            {
                window.location = jfbc.base + 'index.php?option=com_users&task=user.logout&return=' + redirect + '&' + jfbc.token + '=1';
            });
            jfbc.login.logout_button_click();
        }
    },
    permissions: {
        // scope: comma-separated list of permissions to check
        check: function (scope)
        {
            var c = jfbc.cookie.get('jfbconnect_permissions_granted');
            if (c === null)
                return false;

            var permissions = [];
            permissions = jfbcJQuery.parseJSON(c);

            var checkScope = scope.split(',');
            var scopeFound = true;
            jfbcJQuery.each(checkScope, function (k, v)
            {
                if (jfbcJQuery.inArray(v, permissions) == -1)
                    scopeFound = false;
            });
            return scopeFound;
        },

        // Called at initialization
        // If called independently, use the jfbcJQuery.one("jfbc-permissions-fetched", ..) code to check new values
        fetch: function ()
        {
            jfbc.debug.log("permissions_fetch");

            FB.api('/me/permissions', function (response)
            {
                var permissions = "";
                if (response.data !== undefined && jfbcJQuery.isArray(response.data))
                {
                    jfbcJQuery.each(response.data, function (k, v)
                    {
                        // Check for v2.0 of Graph API
                        if ('permission' in v)
                        {
                            if (v.status == "granted")
                                permissions = permissions + '","' + v.permission;
                        }
                        else
                        {
                            jfbcJQuery.each(v, function (perm, value)
                            {
                                permissions = permissions + '","' + perm;
                            });
                        }
                    });
                    // Can't use JSON.stringify as it's incompatible with IE7 :(
                    permissions = permissions + '"';
                    permissions = permissions.substring(2, permissions.length);

                    jfbc.cookie.set('jfbconnect_permissions_granted', "[" + permissions + "]");
                }
                jfbcJQuery(document).trigger("jfbc-permissions-fetched");
            });
        },
        // newScope = comma-separated list of scope to request
        update_scope: function (newScope)
        {
            var jfbcScope = jfbc.login.scope.split(',');
            newScope = newScope.split(',');
            newScope = jfbcJQuery.merge(jfbcScope, newScope);
            newScope = jfbcJQuery.grep(newScope, function (v, k)
            { // Create a new scope array with no duplicates
                return jfbcJQuery.inArray(v, newScope) === k;
            });
            jfbc.login.scope = newScope.join(',');
            jfbc.debug.log("update_scope: Now set to " + jfbc.login.scope);
        }
    },

    social: {
        comment: {
            create: function (response)
            {
                var url = 'option=com_jfbconnect&task=social.commentCreate&href=' + encodeURIComponent(escape(response.href)) + '&commentID=' + response.commentID + '&title=' + document.title;
                jfbc.util.ajax(url, null);
            }
        },
        like: {
            create: function (response)
            {
                var url = 'option=com_jfbconnect&task=social.likeCreate&href=' + encodeURIComponent(escape(response)) + '&title=' + document.title;
                jfbc.util.ajax(url, null);
            }
        },
        /**
         * Tracks Facebook likes, unlikes and sends by suscribing to the Facebook
         * JSAPI event model. Note: This will not track facebook buttons using the
         * iFrame method.
         */
        googleAnalytics: {
            trackFacebook: function ()
            {
                var opt_pageUrl = window.location;
                try
                {
                    if (FB && FB.Event && FB.Event.subscribe)
                    {
                        FB.Event.subscribe('edge.create', function (targetUrl)
                        {
                            _gaq.push(['_trackSocial', 'facebook', 'like',
                                targetUrl, opt_pageUrl]);
                        });
                        FB.Event.subscribe('edge.remove', function (targetUrl)
                        {
                            _gaq.push(['_trackSocial', 'facebook', 'unlike',
                                targetUrl, opt_pageUrl]);
                        });
                        FB.Event.subscribe('message.send', function (targetUrl)
                        {
                            _gaq.push(['_trackSocial', 'facebook', 'send',
                                targetUrl, opt_pageUrl]);
                        });
                        FB.Event.subscribe('comment.create', function (targetUrl)
                        {
                            _gaq.push(['_trackSocial', 'facebook', 'comment',
                                targetUrl, opt_pageUrl]);
                        });
                        FB.Event.subscribe('comment.remove', function (targetUrl)
                        {
                            _gaq.push(['_trackSocial', 'facebook', 'uncomment',
                                targetUrl, opt_pageUrl]);
                        });
                    }
                }
                catch (e)
                {
                }
            }
        },

        // Not published yet. Need to figure out the best way to incorporate this into pages
        feedPost: function (title, caption, description, url, picture)
        {
//            javascript:jfbc.social.feedPost('SourceCoast JE', 'My caption', 'Great extensions!', 'http://www.sourcecoast.com/', 'https://www.sourcecoast.com/images/stories/extensions/jfbconnect/home_jfbconn.png');
            var obj = {
                method: 'feed',
                link: url,
                picture: picture,
                name: title, // page title?
                caption: caption,
                description: description
            };

            function callback(response)
            {
            }

            FB.ui(obj, callback);
        },

        share: function ()
        {
            var element = jfbcJQuery('.jfbcsocialshare');
            if (!element.length)
                element = jfbcJQuery('<div class="jfbcsocialshare"></div>').appendTo('body');
            jfbcJQuery('.jfbcsocialshare').fadeIn(1000);
        }
    },

    canvas: {
        checkFrame: function ()
        {
            if (top == window)
            { // crude check for any frame
                if (window.location.search == "")
                    top.location.href = window.location.href + '?jfbcCanvasBreakout=1';
                else
                    top.location.href = window.location.href + '&jfbcCanvasBreakout=1';
            }
        }
    },

    request: {
        currentId: null,
        popup: function (jfbcReqId)
        {
            jfbc.request.currentId = jfbcReqId;
            data = jfbcRequests[jfbcReqId];
            FB.ui({method: 'apprequests', display: 'popup',
                message: data.message,
                title: data.title,
                data: jfbcReqId
            }, jfbc.request.fbCallback);

        },

        fbCallback: function (response)
        {
            if (response != null)
            {
                var rId = response.request;
                var to = response.to;

                var toQuery = "";
                for (var i = 0; i < to.length; i++)
                    toQuery += "&to[]=" + to[i];

                var query = 'option=com_jfbconnect&task=request.requestSent&requestId=' + rId + toQuery + '&jfbcId=' + jfbc.request.currentId;
                jfbc.util.ajax(query, jfbc.request.redirectToThanks);
            }
        },

        redirectToThanks: function ()
        {
            data = jfbcRequests[jfbc.request.currentId];
            if (data.thanksUrl != "" && (window.location.href != data.thanksUrl))
                window.location.href = data.thanksUrl;
        }
    },

    opengraph: {
        triggerAction: function (action, href, params)
        {
            if (params != undefined)
            {
                params = {params: params}; // Wrap it in an extra parameters object so that the query params become an array keyed off params
                params = jfbcJQuery.param(params);
            }
            else
                params = '';

            var url = 'option=com_jfbconnect&task=opengraph.ajaxAction&action=' + action + '&href=' + encodeURIComponent(href) + '&' + params;
            jfbc.debug.log('opengraph.triggerAction url: ' + url);
            jfbc.util.ajax(url, jfbc.opengraph.actionPopup);
        },
        actionPopup: function (message)
        {
            if (message != '')
            {
                jfbc.debug.log("Open Graph Action response: " + message);
                var element = jfbcJQuery('#ogActionPopup');
                if (!element.length)
                    element = jfbcJQuery('<div id="ogActionPopup"></div>').appendTo('body');
                element.html(message).hide();
                jfbcJQuery('#ogActionPopup').fadeIn(1000);
                setTimeout("jfbcJQuery('#ogActionPopup').fadeOut(1000)", 15000);
            }
        }
    },

    share: {
        messages: {
            action_text: "Post to Timeline",
            close: "Close",
            custom_message: "Message",
            custom_message_placeholder: "Write something about the %s",
            error: "Error",
            success: "Posted to Facebook!",
            view_on_facebook: "View %s story on Facebook"
        },
        build_with_at_text: function ()
        {
            var message_data = jfbcJQuery("#composer-message-data");
            if (message_data.length === 0)
            {
                return;
            }
            var component = jfbcJQuery("<span />");
            if (jfbc.share.friends.tagged !== undefined && !jfbcJQuery.isEmptyObject(jfbc.share.friends.tagged))
            {
                var friends = jfbcJQuery("<span />").addClass("friends").text(" " + jfbc.share.friends.autocomplete.messages.intro_text + " ");
                jfbcJQuery.each(jfbc.share.friends.tagged, function (id, values)
                {
                    friends.append(jfbcJQuery("<a />").addClass("friend").attr({href: values.link, target: "_blank"}).text(values.name).data("fbid", id));
                });
                if (!friends.is(":empty"))
                {
                    component.append(friends);
                }
                friends = null;
            }
            if (jfbc.share.place.tagged !== undefined)
            {
                component.append(jfbcJQuery("<span />").addClass("place").text(" " + jfbc.share.place.autocomplete.messages.intro_text + " ").append(jfbcJQuery("<a />").attr({href: jfbc.share.place.tagged.link, target: "_blank"}).text(jfbc.share.place.tagged.name)));
            }

            // clear any previously stored elements and their handlers
            message_data.empty();
            if (component.is(":empty"))
            {
                // hide the extra component
                message_data.hide();
            } else
            {
                message_data.show();
                message_data.append(component.html());
            }
        },

        story_uri: function (story_id)
        {
            if (jfbc.user.link !== undefined)
            {
                return jfbc.user.link + "/activity/" + story_id;
            } else
            {
                return "https://www.facebook.com/" + story_id;
            }
        },
        form_handler: function (e)
        {
            if (e.preventDefault)
            {
                e.preventDefault(); // Don't POST the form
            }
            var params = {
                message: jfbc.util.encode_data(jfbcJQuery.trim(jfbcJQuery("#composer-message").val())),
                explicitly_shared: jfbcJQuery.trim(jfbcJQuery("#explicitly_shared").val())
            };
            var actionId = jfbcJQuery("#jfbc-action-id").val()
            if (jfbc.share.place.tagged !== undefined && jfbc.share.place.tagged.id !== undefined)
            {
                params.place = jfbc.share.place.tagged.id;
            }
            if (jfbc.share.friends.tagged !== undefined && !jfbcJQuery.isEmptyObject(jfbc.share.friends.tagged))
            {
                params.tags = Object.keys(jfbc.share.friends.tagged).join(",");
            }
            jfbcJQuery("#jfbc-share-modal").modal("hide");
            jfbc.opengraph.triggerAction(actionId, window.location, params);
            // Disable automatically now. Need to do this only if the action is successful
            //jfbcJQuery('button#share-button').addClass('disabled');
            return false;
        },

        display_modal: function (actionId, capabilities)
        {
            jfbc.debug.log(capabilities);
            if (jfbc.login.logged_in)
            {
                if (jfbc.permissions.check('publish_actions')) // Check for permission, and request if not granted
                {
                    jfbc.debug.log("display_modal: Permission found! Showing.");
                    jfbc.share.show_composer(actionId, capabilities);
                    return true;
                } else
                {
                    jfbcJQuery(document).one("jfbc-permissions-fetched", function ()
                    {
                        jfbc.debug.log("display_modal: Permission fetched and found! Showing.");
                        if (jfbc.permissions.check('publish_actions')) // Check for permission, and request if not granted
                            jfbc.share.show_composer(actionId, capabilities);
                    });
                }
            }
            // If we get here, we're either not logged in or don't have the right permissions.
            // Log the user in, or update their permissions and auto-show the modal (using the on-event above)
            jfbc.permissions.update_scope('publish_actions');
            jfbc.login.provider('facebook');
            return false;
        },

        show_composer: function (actionId, capabilities)
        {
            jfbc.util.loadJQueryUi();
            /*            if (!jfbc.share.jquery_ui_loaded)
             {
             jfbcJQuery.getScript(jfbc.base + "media/sourcecoast/js/jquery-ui.min.js").done(function ()
             {
             jfbc.share.jquery_ui_loaded = true;
             jfbc.share.add_composer(actionId, capabilities);
             });
             }
             else*/
            jfbc.share.add_composer(actionId, capabilities);
        },

        // add the modal code to the page and pop it up. Do not call directly. Use display_modal above.
        add_composer: function (actionId, capabilities)
        {
            jfbc.share.friends.tagged = {};
            jfbc.debug.log("add_composer: Action " + actionId + ", capabilities: " + capabilities);

            var form = jfbcJQuery("<form />").attr({id: "jfbc-share-composer"}).submit(jfbc.share.form_handler);
            form.append(jfbcJQuery("<input />").attr({"id": "jfbc-action-id", "type": "hidden"}).val(actionId));

            var modal_body = jfbcJQuery("<div />").addClass("modal-body");
            if (jfbcJQuery.inArray("messages", capabilities) != -1)
            {
                modal_body.append(jfbcJQuery("<div />").attr("id", "composer-message-group").addClass("control-group")
                    .append(
                        jfbcJQuery("<label />").addClass("control-label").attr("for", "composer-message").text(jfbc.share.messages.custom_message)
                    ).append(
                        jfbcJQuery("<div />").addClass("controls").append(jfbcJQuery("<input />").addClass("input-xxlarge").attr({id: "composer-message", type: "text", maxlength: 1000, autocomplete: "off", placeholder: "Add a comment" }))
                    ).append(
                        jfbcJQuery("<span />").attr("id", "composer-message-data").hide())
                );
            }
            if (jfbcJQuery.inArray("tags", capabilities) != -1)
            {
                modal_body.append(jfbcJQuery("<div />").attr("id", "autocomplete-fields").append(
                        jfbc.share.friends.build_form_fields()
                    ).append(
                        jfbc.share.place.build_form_fields()
                    ));
                modal_body.append(jfbcJQuery("<div />").addClass("btn-group").attr("id", "composer-buttons").append(
                        jfbc.share.place.build_toggle()
                    ).append(
                        jfbc.share.friends.build_toggle()
                    ));
            }
            if (jfbcJQuery.inArray("explicitly_shared", capabilities) != -1)
                form.append(jfbcJQuery("<input />").attr({"id": "explicitly_shared", "type": "hidden"}).val("true"));
            else
                form.append(jfbcJQuery("<input />").attr({"id": "explicitly_shared", "type": "hidden"}).val("false"));

            var dataDismiss;
            if (jfbc.jqcompat)
                dataDismiss = 'sc-modal';
            else
                dataDismiss = 'modal';
            modal = jfbcJQuery("<div />").addClass("sourcecoast modal").attr({id: "jfbc-share-modal", role: "dialog", "aria-labelledby": "modal-title"});
            modal.append(jfbcJQuery("<div />").addClass("modal-header").append(jfbcJQuery("<button />").addClass("close").attr({type: "button", "data-dismiss": dataDismiss, "aria-hidden": "true"}).text("×")).append(jfbcJQuery("<h3 />").attr("id", "modal-title").text(jfbc.share.messages.action_text)));
            modal.append(modal_body);
            modal_body = null;
            modal.append(jfbcJQuery("<div />").addClass("modal-footer").append(jfbcJQuery("<button />").addClass("btn").attr({"data-dismiss": dataDismiss, "aria-hidden": "true"}).text(jfbc.share.messages.close)).append(jfbcJQuery("<button />").addClass("btn btn-primary").attr("type", "submit").text(jfbc.share.messages.action_text)));
            form.append(modal);

            if (jfbcJQuery("#jfbc-share-composer").length) // Replace any existing modals with the newly created one
                jfbcJQuery("#jfbc-share-composer").replaceWith(form);
            else
                jfbcJQuery('body').append(form);

            jfbcJQuery("#jfbc-share-modal").modal();

        },

        // search for a place matching text near a fixed point
        place: {
            messages: {
                add_location: "Add location",
                icon: "Facebook Location icon",
                placeholder: "Where are you?"
            },
            build_form_fields: function ()
            {
                return jfbcJQuery("<div />").attr("id", "composer-place-group").append(jfbcJQuery("<input />").attr({type: "search", role: "combobox", id: "composer-place-field", autocomplete: "off", placeholder: jfbc.share.place.messages.placeholder, "aria-label": jfbc.share.place.messages.placeholder})).hide();
            },
            build_toggle: function ()
            {
                var button = jfbcJQuery("<button />").attr({
                    "id": "toggle-place",
                    "type": "button",
                    "title": jfbc.share.place.messages.add_location,
                    "aria-controls": "composer-place-group"
                }).addClass("btn");
                button.append(jfbcJQuery("<img />").attr({
                    "alt": jfbc.share.place.messages.icon,
                    "src": jfbc.base + "media/sourcecoast/images/opengraph/location.png",
                    "width": 32,
                    "height": 32
                }));
                button.one("click", jfbc.share.place.autocomplete.init);
                button.click(jfbc.share.place.handle_click);
                return button;
            },
            handle_click: function ()
            {
                var button = jfbcJQuery("#toggle-place");
                jfbcJQuery("#composer-place-group").toggle();
                if (button.hasClass("active"))
                {
                    button.removeClass("active");
                } else
                {
                    button.addClass("active");
                    var friend_button = jfbcJQuery("#toggle-friends");
                    // one active button display at a time
                    if (friend_button.hasClass("active"))
                    {
                        friend_button.click();
                    }
                    jfbc.share.place.clear();
                    jfbc.share.place.autocomplete.search_field.focus();
                }
            },
            clear: function ()
            {
                delete jfbc.share.place.tagged;
                jfbcJQuery("#composer-place-field").val("");
                jfbc.share.build_with_at_text();
            },
            autocomplete: {
                search_params: {}, // persist parameters between searches
                messages: {
                    were_here: "%s were here",
                    intro_text: "at"
                },
                init: function ()
                {
                    jfbc.share.place.autocomplete.search_field = jfbcJQuery("#composer-place-field");
                    if (jfbc.share.place.autocomplete.search_field.length === 0)
                    {
                        return;
                    }
                    jfbc.share.place.autocomplete.search_field.attr("placeholder", jfbc.share.place.autocomplete.messages.placeholder);
                    jfbc.share.place.autocomplete.search_field.autocomplete({
                        appendTo: "#composer-place-group",
                        autoFocus: true,
                        minLength: 3,
                        focus: function (event, ui)
                        {
                            // add consistency between mouse and keyboard events
                            if (event.keyCode !== undefined)
                            {
                                var menu = $(this).data("ui-autocomplete").menu.element, focused = menu.find("li:has(a.ui-state-focus)");
                                menu.find(".ui-state-focus").removeClass("ui-state-focus");
                                focused.addClass("ui-state-focus");
                                menu = focused = null;
                            }
                            return false;
                        },
                        select: function (event, ui)
                        {
                            jfbc.share.place.tagged = {id: ui.item.value, name: ui.item.label, link: ui.item.link};
                            jfbc.share.build_with_at_text();
                            jfbc.share.place.autocomplete.search_field.autocomplete("close");
                            jfbcJQuery("#toggle-place").click();
                            return false;
                        },
                        source: function (request, response)
                        {
                            if (request.term === undefined || request.term.length < 3)
                            {
                                return;
                            }
                            var params = {option: 'com_jfbconnect', task: 'ajax.places', q: request.term};
                            params[jfbc.token] = 1;
                            jfbcJQuery.getJSON(jfbc.base + "index.php?" + jfbcJQuery.param(jfbcJQuery.extend({}, jfbc.share.place.autocomplete.search_params, params))).done(function (results)
                            {
                                response(results)
                            }).fail(function ()
                                {
                                    response([])
                                });
                        }
                    });
                    jfbc.share.place.autocomplete.search_field.data("ui-autocomplete")._renderItem = jfbc.share.place.autocomplete.renderItem;
                    jfbc.share.place.autocomplete.search_field.attr("aria-haspopup", "true");
                    if ("geolocation" in navigator)
                    {
                        navigator.geolocation.getCurrentPosition(function (position)
                        {
                            jfbc.share.place.autocomplete.update_coordinates(position.coords.latitude, position.coords.longitude);
                        });
                    }
                },
                // override jQuery UI autocomplete default item listing
                renderItem: function (ul, place)
                {
                    var li = jfbcJQuery("<li />").addClass("place").attr({"role": "option", "aria-label": place.label}).mouseenter(function ()
                    {
                        jfbcJQuery(this).addClass("ui-state-focus")
                    }).mouseleave(function ()
                        {
                            jfbcJQuery(this).removeClass("ui-state-focus")
                        });
                    if (place.picture !== undefined)
                    {
                        li.append(jfbcJQuery("<img />").attr({src: place.picture, alt: place.label, width: 25, height: 25}));
                    }

                    var text_pieces = [place.label];
                    if (place.location !== undefined)
                    {
                        if (place.location.street !== undefined)
                        {
                            text_pieces.push(place.location.street);
                        }
                        if (place.location.area !== undefined)
                        {
                            text_pieces.push(place.location.area);
                        }
                    }
                    li.append(jfbcJQuery("<a />").addClass("text").text(text_pieces.join(" • ")));

                    if (place.were_here_count !== undefined)
                    {
                        li.append(jfbcJQuery("<div />").addClass("subtext").text(jfbc.share.place.autocomplete.messages.were_here.replace(/%s/i, jfbc.util.format_number(place.were_here_count))));
                    }

                    return li.appendTo(ul);
                },
                update_coordinates: function (latitude, longitude)
                {
                    if (latitude === undefined || longitude === undefined)
                    {
                        return;
                    }
                    jfbc.share.place.autocomplete.search_params.center = latitude + "," + longitude;
                }
            }
        },

        friends: {
            tagged: {},
            messages: {
                icon: "Facebook silhouette icon",
                tag_friends: "Tag friends",
                placeholder: "Who are you with?"
            },
            build_form_fields: function ()
            {
                return jfbcJQuery("<div />").addClass("form-inline").attr("id", "composer-friends-group").append(jfbcJQuery("<ul />").addClass("unstyled inline").attr("id", "composer-friends-group-fields").append(jfbcJQuery("<li />").append(
                    jfbcJQuery("<input />").attr({type: "search", role: "combobox", id: "composer-friends-field", autocomplete: "off", placeholder: jfbc.share.friends.messages.placeholder, "aria-label": jfbc.share.friends.messages.placeholder})
                ))).hide();
            },
            build_toggle: function ()
            {
                var button = jfbcJQuery("<button />").attr({
                    "id": "toggle-friends",
                    "type": "button",
                    "title": jfbc.share.friends.messages.tag_friends,
                    "aria-controls": "composer-friends-group"
                }).addClass("btn");
                button.append(jfbcJQuery("<img />").attr({
                    "alt": jfbc.share.friends.messages.icon,
                    "src": jfbc.base + "media/sourcecoast/images/opengraph/friend.png",
                    "width": 32,
                    "height": 32
                }));
                button.one("click", jfbc.share.friends.autocomplete.init);
                button.click(jfbc.share.friends.handle_click);
                return button;
            },
            handle_click: function ()
            {
                var button = jfbcJQuery("#toggle-friends");
                jfbcJQuery("#composer-friends-group").toggle();
                if (button.hasClass("active"))
                {
                    button.removeClass("active");
                } else
                {
                    button.addClass("active");
                    var place_button = jfbcJQuery("#toggle-place");
                    // one active button display at a time
                    if (place_button.hasClass("active"))
                    {
                        place_button.click();
                    }
                    jfbc.share.friends.autocomplete.search_field.focus();
                }
            },
            // search for friends matching text
            autocomplete: {
                messages: {
                    intro_text: "with",
                    remove: "Remove %s"
                },
                init: function ()
                {
                    jfbc.share.friends.autocomplete.search_field = jfbcJQuery("#composer-friends-field");
                    if (jfbc.share.friends.autocomplete.search_field.length === 0)
                    {
                        return;
                    }
                    jfbc.share.friends.autocomplete.search_field.autocomplete({
                        appendTo: "#composer-friends-group",
                        autoFocus: true,
                        minLength: 2,
                        focus: function (event, ui)
                        {
                            // add consistency between mouse and keyboard events
                            if (event.keyCode !== undefined)
                            {
                                var menu = $(this).data("ui-autocomplete").menu.element, focused = menu.find("li:has(a.ui-state-focus)");
                                menu.find(".ui-state-focus").removeClass("ui-state-focus");
                                focused.addClass("ui-state-focus");
                                menu = focused = null;
                            }
                            return false;
                        },
                        select: function (event, ui)
                        {
                            jfbc.share.friends.tagged[ui.item.value] = {name: ui.item.label, link: ui.item.link};
                            jfbc.share.build_with_at_text();
                            jfbcJQuery("#composer-friends-group-fields").prepend(jfbcJQuery("<li />").data("fbid", ui.item.value).addClass("friend").append(jfbcJQuery("<a />").attr({href: ui.item.link, target: "_blank"}).text(ui.item.label)).append(jfbcJQuery("<button />").addClass("btn btn-link").attr({type: "button", title: jfbc.share.friends.autocomplete.messages.remove.replace(/%s/i, ui.item.label)}).text("×").click(jfbc.share.friends.autocomplete.remove_friend)));
                            jfbc.share.friends.autocomplete.search_field.autocomplete("close");
                            jfbc.share.friends.autocomplete.search_field.val("");
                            jfbc.share.friends.autocomplete.search_field.focus();
                            //jfbcJQuery("#toggle-friends").click();
                            return false;
                        },
                        source: function (request, response)
                        {
                            if (request.term === undefined || request.term.length < 2)
                            {
                                return;
                            }
                            var params = {option: 'com_jfbconnect', task: 'ajax.friends', q: request.term};
                            params[jfbc.token] = 1;
                            jfbcJQuery.getJSON(jfbc.base + "index.php?" + jfbcJQuery.param(params)).done(function (results)
                            {
                                jfbc.debug.log(response);
                                response(results);
                            }).fail(function ()
                                {
                                    jfbc.debug.log(response);
                                    response([])
                                });
                        }
                    });
                    jfbc.share.friends.autocomplete.search_field.data("ui-autocomplete")._renderItem = jfbc.share.friends.autocomplete.renderItem;
                    jfbc.share.friends.autocomplete.search_field.attr("aria-haspopup", "true");
                },
                remove_friend: function ()
                {
                    var friend = jfbcJQuery(this).closest(".friend");
                    if (friend.length === 0)
                    {
                        return;
                    }
                    delete jfbc.share.friends.tagged[friend.data("fbid")];
                    friend.remove();
                    jfbc.share.build_with_at_text();
                    jfbc.share.friends.autocomplete.search_field.focus();
                },
                // override jfbcJQuery UI autocomplete default item listing
                renderItem: function (ul, friend)
                {
                    return jfbcJQuery("<li />").addClass("friend").attr({"role": "option", "aria-label": friend.label}).mouseenter(function ()
                    {
                        jfbcJQuery(this).addClass("ui-state-focus")
                    }).mouseleave(function ()
                        {
                            jfbcJQuery(this).removeClass("ui-state-focus")
                        }).append(
                            jfbcJQuery("<img />").attr({src: (friend.picture === undefined) ? "https:\/\/graph.facebook.com\/" + friend.value + "\/picture" : friend.picture, alt: friend.label, width: 25, height: 25})).append(
                            jfbcJQuery("<a />").addClass("text").text(friend.label)
                        ).appendTo(ul);
                }
            }
        }
    },

    toolbar: {
        close: {
            display: function ()
            {
                jfbcJQuery("#social-toolbar").hide();
            }
        },
        meta: {
            display: function ()
            {
                if (jfbcJQuery('#social-meta').css('display') == 'none')
                {
                    jfbcJQuery('#social-meta').accordion();
                    jfbcJQuery('#social-meta').css('display', 'block');
                    jfbcJQuery('#social-meta').accordion('refresh');
                }
                else
                    jfbcJQuery('#social-meta').css('display', 'none');
            }
        },
        post: {
            display: function ()
            {
                jfbcJQuery('#social-post-container').html("")
                    .append(jfbcJQuery("<div />").attr("id", "progressbar").progressbar({value: false}))
                    .css('display', 'block')
                    .dialog({title: "Loading..."});

                var query = 'option=com_jfbconnect&task=ajax.fetch&library=toolbar.post&subtask=getHtml';
                jfbc.util.ajax(query, jfbc.popup.display);
            },
            submit: function ()
            {
                jfbcJQuery("#social-post-container").dialog({buttons: null });
                var form = jfbcJQuery('#social-post-form');
                var url = form.attr("action") + '&' + jfbc.token + '=1';
                var data = form.serializeArray();
                data.push({name: 'link', value: window.location.href});
                jfbcJQuery.post(url, data).done(function (ret)
                {
                    jfbcJQuery("#social-post-popup").html(ret);
                    jfbcJQuery("#social-post-container").dialog({buttons: {Close: function ()
                    {
                        jfbcJQuery(this).dialog("close");
                    } } });
                });
            }
        }
    },

    popup: {
        display: function (ret)
        {
            var data = jfbcJQuery.parseJSON(ret);
            jfbcJQuery(data.target).html(data.html);

            var buttons = {};
            if (data.buttons)
            {
                for (var i = 0; i < data.buttons.length; i++)
                {
                    var button = data.buttons[i];
                    buttons[button.name] = {
                        text: button.name,
                        id: button.id,
                        click: function ()
                        {
                            var action = jfbc.get(button.action);
                            action();
                        }
                    };
                }
            }
            buttons["Cancel"] = {
                text: "Cancel",
                id: 'jfbc-popup-close',
                click: function ()
                {
                    jfbcJQuery(this).dialog("close");
                }
            };
            jfbcJQuery(data.target).dialog({buttons: buttons, title: data.title,
                width: '50%',
                close: function ()
                {
                    jfbcJQuery(data.target).html("");
                }
            });
            jfbcJQuery(data.target).css('display', 'block');
        }
    },

    get: function (prop)
    {
        var path = prop.split('.');
        var value = window;
        for (var i = 0; i < path.length; i++)
        {
            if (value[path[i]])
                value = value[path[i]];
        }
        return value;
    },

    util: {
        thousands_separator: ",",
        // format an integer such as 1234 to a string with a thousands separator: 1,234
        format_number: function (num)
        {
            return num.toString().replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1" + jfbc.util.thousands_separator);
        },
        encode_data: function (data)
        {
            return encodeURIComponent(data).replace(/\-/g, "%2D").replace(/\_/g, "%5F").replace(/\./g, "%2E").replace(/\!/g, "%21").replace(/\~/g, "%7E").replace(/\*/g, "%2A").replace(/\'/g, "%27").replace(/\(/g, "%28").replace(/\)/g, "%29");
        },
        // Abstracted originally for use in different Mootools libraries. Remains in case future jfbcJQuery changes introduced
        ajax: function (url, callback)
        {
            url = url + '&' + jfbc.token + '=1';
            jfbcJQuery.ajax({url: 'index.php', data: url}).done(callback);
        },

        jqueryUiLoaded: false,
        loadJQueryUi: function ()
        {
            if (!jfbc.util.jqueryUiLoaded)
            {
                jfbcJQuery.getScript(jfbc.base + "media/sourcecoast/js/jquery-ui.min.js").done(function ()
                {
                    jfbc.util.jqueryUiLoaded = true;
                });
            }
        }
    },
    debug: {
        enable: 0,
        log: function (string)
        {
            if (jfbc.debug.enable == 1)
                console.log("JFBConnect logger: " + string);
        },
        stats: function ()
        {
            var element = jfbcJQuery('#jfbcAdminStats');
            if (!element.length)
                element = jfbcJQuery('<div id="jfbcAdminStats"></div>').appendTo('body');
            jfbcJQuery('#jfbcAdminStats').fadeIn(1000);
        }
    },
    cookie: {
        get: function (sKey)
        {
            return unescape(document.cookie.replace(new RegExp("(?:(?:^|.*;)\\s*" + escape(sKey).replace(/[\-\.\+\*]/g, "\\$&") + "\\s*\\=\\s*([^;]*).*$)|^.*$"), "$1")) || null;
        },
        set: function (sKey, sValue)
        {
            if (!sKey || /^(?:expires|max\-age|path|domain|secure)$/i.test(sKey))
            {
                return false;
            }
            document.cookie = escape(sKey) + "=" + escape(sValue) + "; path=/";
            return true;
        }
    },


    init: function ()
    {
        if (typeof jfbcJQuery == "undefined")
        {
            jfbcJQuery = jQuery;
            jfbc.jqcompat = false;
        }
        else
            jfbc.jqcompat = true;

        if (jfbc.login.logged_in && jfbc.login.logout_facebook)
        {
            jfbcJQuery(document).ready(function ()
            {
                jfbcJQuery(".sclogout-button form").submit(function (e)
                {
                    e.preventDefault();
                    jfbcJQuery(document).one("jfbc-provider-logout-done", null, {caller: this }, function (e)
                    {
                        e.data.caller.submit();
                    });
                    jfbc.login.logout_button_click();
                    return false;
                });
            });
        }


        jfbcJQuery(document).ready(function ()
        {
            jfbc.social.share();
            if (jfbcJQuery('#social-toolbar').length)
            {
                jfbc.util.loadJQueryUi();
                jfbcJQuery('#social-toolbar button').click(function ()
                {
                    var method = jfbcJQuery(this).attr("name");
                    jfbc.toolbar[method].display();
                });
            }
        });
    }

};