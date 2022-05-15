jQuery.noConflict();
// IE checker
function gkIsIE() {
  if (navigator.userAgent.match(/msie/i) ){ return true; }
  else { return false; }
}
//
var page_loaded = false;
//
jQuery(window).load(function() {
	//
	page_loaded = true;
	// smooth anchor scrolling
    jQuery('a[href*="#"]').on('click', function (e) {
        e.preventDefault();
        if(this.hash !== '') {
            if(this.hash !== '' && this.href.replace(this.hash, '') == window.location.href.replace(window.location.hash, '')) {
                var target = jQuery(this.hash);
                if(target.length && this.hash !== '#') {
                    jQuery('html, body').stop().animate({
                        'scrollTop': target.offset().top
                    }, 1000, 'swing', function () {
                        if(this.hash !== '#') {
                            window.location.hash = target.selector;
                        }
                    });
                } else {
                    if(this.hash !== '#') {
                        window.location = jQuery(this).attr('href');
                    }
                }
            } else {
                if(this.hash !== '#') {
                    window.location = jQuery(this).attr('href');
                }
            }
        }
    });
	// style area
	if(jQuery('#gkStyleArea').length > 0){
		jQuery('#gkStyleArea').find('a').each(function(i, element){
			jQuery(element).click(function(e){
				e.preventDefault();
				e.stopPropagation();
				changeStyle(i+1);
			});
		});
	}
	// K2 font-size switcher fix
	if(jQuery('#fontIncrease').length > 0 && jQuery('.itemIntroText').length > 0) {
		jQuery('#fontIncrease').click(function() {
			jQuery('.itemIntroText').attr('class', 'itemIntroText largerFontSize');
		});
		
		jQuery('#fontDecrease').click( function() {
			jQuery('.itemIntroText').attr('class', 'itemIntroText smallerFontSize');
		});
	}
	// Event progress
	var gk_events = jQuery('.gkEvent');
	//
	if(gk_events.length) {
		gk_events.each(function(i, event) {
			event = jQuery(event);
			var timezone_value = event.find('.gkEventTimeStart').data('timezone') || 0;
			var date_timezone = -1 * parseInt(timezone_value, 10) * 60;
			
			var temp_date = new Date();
			var user_timezone = temp_date.getTimezoneOffset();
			var new_timezone_offset = 0;
			// if the timezones are equal - do nothing, in the other case we need calculations:
			if(date_timezone !== user_timezone) {
				new_timezone_offset = user_timezone - date_timezone;
				// calculate new timezone offset to miliseconds
				new_timezone_offset = new_timezone_offset * 60 * 1000;
			}
			
			var progress = event.find('.gkEventCounter');
			var progress_bar = jQuery('<div/>');
			progress_bar.appendTo(progress);
			
			var end = event.find('.gkEventDateStart').attr('datetime').split('-');
			var end_time = event.find('.gkEventTimeStart').attr('datetime').split(':');
			var end_date = Date.UTC(end[2], end[1]-1, end[0], end_time[0], end_time[1]);
			end_date = end_date + new_timezone_offset;
			
			var start = event.find('.gkEventCounter').attr('datetime').split('-');
			var start_date = Date.UTC(start[2], start[1]-1, start[0], 0, 0);
			start_date = start_date + new_timezone_offset;
			
			var diff = end_date - start_date;
			var current = new Date();
			var current_date = new Date(current.getFullYear(), current.getMonth(), current.getDate(), 0, 0);
			progress = 1 - Math.round(((end_date - current_date) / diff) * 1000) / 1000;
			progress = Math.round(progress * 1000) / 1000;
			setTimeout(function() {
				progress_bar.css('width', progress * 100 + "%");
			}, 1000);
		});
	}
	// login popup
	if(jQuery('#gkPopupLogin').length > 0) {
		var popup_overlay = jQuery('#gkPopupOverlay');
		popup_overlay.css({'display': 'block', 'opacity': '0'});
		popup_overlay.fadeOut();

		var opened_popup = null;
		var popup_login = null;
		var popup_login_h = null;
	
		if(jQuery('#gkPopupLogin').length > 0 && jQuery('.gkLogin').length > 0) {
			popup_login = jQuery('#gkPopupLogin');
			jQuery('.gkLogin').click(function(e) {
				e.preventDefault();
				e.stopPropagation();
				
				popup_overlay.css('opacity',0.01);
				popup_login.css('display', 'block');
			
				popup_overlay.css('height', jQuery('body').height());
				popup_overlay.fadeTo('slow', 0.45 );

				setTimeout(function() {
					popup_login.animate({'opacity': 1}, 500);
					opened_popup = 'login';
				}, 450);

				(function() {
					if(jQuery('#modlgn-username').length > 0) {
						jQuery('#modlgn-username').focus();
					}
				}).delay(600);
			});
		}
		
		popup_overlay.click(function() {
			if(opened_popup === 'login')	{
				popup_overlay.fadeOut();
				popup_login.animate({'opacity' : 0}, 500);
				setTimeout(function() {
					popup_login.css('display', 'none');
				}, 450);
			}
		});		
	}	
});
// Function to change styles
function changeStyle(style){
	// cookie function
	jQuery.cookie = function (key, value, options) {
    // key and at least value given, set cookie...
    if (arguments.length > 1 && String(value) !== "[object Object]") {
        options = jQuery.extend({}, options);
        if (value === null || value === undefined) {
            options.expires = -1;
        }
        if (typeof options.expires === 'number') {
            var days = options.expires, t = options.expires = new Date();
            t.setDate(t.getDate() + days);
        }

        value = String(value);

        return (document.cookie = [
            encodeURIComponent(key), '=',
            options.raw ? value : encodeURIComponent(value),
            options.expires ? '; expires=' + options.expires.toUTCString() : '', // use expires attribute, max-age is not supported by IE
            options.path ? '; path=' + options.path : '',
            options.domain ? '; domain=' + options.domain : '',
            options.secure ? '; secure' : ''
        ].join(''));
    }
    // key and possibly options given, get cookie...
    options = value || {};
    var result, decode = options.raw ? function (s) { return s; } : decodeURIComponent;
    return (result = new RegExp('(?:^|; )' + encodeURIComponent(key) + '=([^;]*)').exec(document.cookie)) ? decode(result[1]) : null;
	};

	var file1 = $GK_TMPL_URL+'/css/style'+style+'.css';
	var file2 = $GK_TMPL_URL+'/css/typography/typography.style'+style+'.css';
	jQuery('head').append('<link rel="stylesheet" href="'+file1+'" type="text/css" />');
	jQuery('head').append('<link rel="stylesheet" href="'+file2+'" type="text/css" />');

	jQuery.cookie('gk_university_j30_style', style, { expires: 365, path: '/' });
}


