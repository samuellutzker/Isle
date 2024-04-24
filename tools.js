'use strict';

const makeMovable = (what, callbackNewPos) => {
	const f = function (e) {
		$(this).off('pointerdown', f);
		// prevent bubbling up from children:
		// if (e.target.id != $(this).prop('id'))
		// 	return;

		let pos = { x: e.clientX, y: e.clientY };
		let offs = $(this).position();
		let dir = { x: 0, y: 0 };

		$(this).css('transition', 'none');

		$(document).on('pointermove', (e) => {
			dir = { x: e.clientX - pos.x, y: e.clientY - pos.y };
			$(this).css('left', offs.left + dir.x + 'px').css('top', offs.top + dir.y + 'px').css('zIndex', 9999);

		});

		$(document).on('pointerup', (e) => {
			$(document).off('pointermove pointerup');
			if (callbackNewPos)
				callbackNewPos({ x: offs.left + dir.x, y: offs.top + dir.y });
			
			// const middle = $(window).height() / 2;
			// if (offs.top+dir.y > middle)
			// 	$(this).addClass('lowerhalf');
			// else
			// 	$(this).removeClass('lowerhalf');

			$(this).css('transition', '').css('zIndex', '').on('pointerdown', f);
		});
	};

	$(what).addClass('movable').on('pointerdown', f);
};


const intercept = function (prevent, filter, except) {
	if (intercept.args) {
		intercept.args.prevent.forEach((x) => window.removeEventListener(x, intercept.preventEvents, true));
		intercept.args.filter.forEach((x) => window.removeEventListener(x, intercept.filterEvents, true));
		intercept.args = null;
	}

	if (prevent || filter) {
		intercept.args = { prevent: (prevent ?? '').split(' '), filter: (filter ?? '').split(' '), except: except };

		intercept.preventEvents = (e) => {
			e.stopPropagation();
			e.preventDefault();
		};

		intercept.filterEvents = (e) => {
			if ($(e.target).parents(intercept.args.except).length == 0)
				intercept.preventEvents(e);
		};

		intercept.args.prevent.forEach((x) => window.addEventListener(x, intercept.preventEvents, {capture: true, passive: false}));
		intercept.args.filter.forEach((x) => window.addEventListener(x, intercept.filterEvents, {capture: true, passive: false}));
	}
};




const closeDialog = () => dialog();

const dialog = (title, text, options, onopen, className) => {


	const closeDialog = () => {
		$("#dialog, #curtain").remove();
		$(document).off('keypress');
		intercept(false);
		dialog.open = false;
		if (dialog.msg.msg) {
    		message(dialog.msg.persistant, dialog.msg.msg);
    	}
		if (dialog.queue !== undefined && dialog.queue.length > 0) {
			dialog(...dialog.queue.shift());
		}
	};


	if (!title && !text) {
		$("#dialog button.default").click(); 
		return;
	}

	if (dialog.open) {
		if (!dialog.queue) dialog.queue = [];
		dialog.queue.push([title, text, options, onopen, className]);
		return;
	}

	dialog.msg = message(); // Close open messages
	dialog.open = true;

    $("#main").append(`<div id='dialog' class='window' title='${title}'><div>${text}</div></div><div id='curtain'></div>`);

    if (className !== undefined) {
    	$("#dialog").addClass(className);
    }

    if (!options || typeof options !== 'object' || Object.keys(options).length == 0) {
        options = {"OK" : null};
    }

    for (let btn in options) {
        let func = options[btn];
        let b = document.createElement("button");
        b.innerHTML = btn;
        b.onclick = (e) => {
            if (typeof func === 'function') {
                func();
            }
            closeDialog();
        };
        $("#dialog").append(b);
    }
    $(`#dialog button`).first().addClass("default");

    $(document).on('keypress', function (e) { 
    	if (e.key == "Enter") { 
    		e.preventDefault(); 
    		$("#dialog button.default").click(); 
    	}
    });

    intercept('pointermove wheel pointerover pointerout', 'click pointerdown pointerup', '#dialog');

    if (typeof onopen === 'function')
    	onopen();
};

// persistant: true/false => timeout off/on for showing the message
// if msg is null, current messages should only be cleared.
// return the arguments for the old message.
const message = (persistant, msg) => {
	const old = { 
		persistant: $("#message").data('timeout') ? false : true,
		msg: $("#message").html()
	};

	if (dialog.open) {
		dialog.msg = { persistant: persistant, msg: msg };
		return;
	}

	if (msg && msg == old.msg && $("#message").is('.inactive'))
		return old;
	
	const msgTimeout = 3500;

	if (!old.persistant) {
		clearTimeout($("#message").data('timeout'));
	}

	$("#message").removeClass('active inactive').data('timeout', null).html(msg);

	// Show message
	if(msg) {
		const timeout = persistant ? null : setTimeout(() => $("#message.active").removeClass("active").addClass("inactive"), msgTimeout);
		$("#message").addClass('active').data('timeout', timeout);
	}

	return old;
}

const capital = (a) => a.charAt(0).toUpperCase() + a.slice(1).toLowerCase();

