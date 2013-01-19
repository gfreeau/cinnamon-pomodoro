const Lang = imports.lang;
const Mainloop = imports.mainloop;

const St = imports.gi.St;
const Pango = imports.gi.Pango;
const Clutter = imports.gi.Clutter;
const Cinnamon = imports.gi.Cinnamon;
const Util = imports.misc.util;
const GLib = imports.gi.GLib;

const Main = imports.ui.main;
const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;
const MessageTray = imports.ui.messageTray;
const ModalDialog = imports.ui.modalDialog;

const Gettext = imports.gettext.domain('cinnamon-applets');
const _ = Gettext.gettext;

const appletUUID = 'pomodoro@gregfreeman.org';
const appletDir = imports.ui.appletManager.appletMeta[appletUUID].path;
const configFilePath = appletDir + '/config.json';

let configOptions = [ // [ <variable>, <config_category>, <actual_option>, <default_value> ]
    ["_pomodoroTime", "timer", "pomodoro_duration", 1500],
    ["_shortPauseTime", "timer", "short_pause_duration", 300],
    ["_longPauseTime", "timer", "long_pause_duration", 900],
    ["_showCountdownTimer", "ui", "show_countdown_timer", true],
    ["_showNotificationMessages", "ui", "show_messages", true],
    ["_showDialogMessages", "ui", "show_dialog_messages", true],
    ["_playSound", "ui", "play_sound", true]
];

function MyApplet(orientation, panel_height) {
    this._init(orientation, panel_height);
}

MyApplet.prototype = {
    __proto__: Applet.TextApplet.prototype,

    _init: function(orientation, panel_height) {
        Applet.TextApplet.prototype._init.call(this, orientation, panel_height);

        try {
            this._parseConfig();

            this._timeSpent = -1;
            this._minutes = 0;
            this._seconds = 0;
            this._stopTimer = true;
            this._isPause = false;
            this._pauseTime = 0;
            this._pauseCount = 0;                                   // Number of short pauses so far. Reset every 4 pauses.
            this._sessionCount = 0;                                 // Number of pomodoro sessions completed so far!
            this._labelMsg = new St.Label({ text: 'Stopped'});
            this._notification = null;
            this._dialog = null;

            // Set default menu
            this._setTimerLabel("[00] 00:00");

            this.menuManager = new PopupMenu.PopupMenuManager(this);
            this.menu = new Applet.AppletPopupMenu(this, orientation);
            this.menuManager.addMenu(this.menu);

            // Toggle timer state button
            this._timerToggle = new PopupMenu.PopupSwitchMenuItem(_("Pomodoro Timer"), false);
            this._timerToggle.connect("toggled", Lang.bind(this, this._toggleTimerState));
            this.menu.addMenuItem(this._timerToggle);

            // Session count
            let item = new PopupMenu.PopupMenuItem(_("Collected"), { reactive: false });
            let bin = new St.Bin({ x_align: St.Align.END });
            this._sessionCountLabel = new St.Label({ text: _('None') }); // ● U+25CF BLACK CIRCLE //style_class: 'popup-inactive-menu-item' });
            bin.add_actor(this._sessionCountLabel);
            item.addActor(bin, { expand: true, span: -1, align: St.Align.END });
            this.menu.addMenuItem(item);

            // Separator
            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

            // Options SubMenu
            this._optionsMenu = new PopupMenu.PopupSubMenuMenuItem(_("Options"));
            this._buildOptionsMenu();
            this.menu.addMenuItem(this._optionsMenu);

            this._createDialogWindow();

            // Start the timer
            this._refreshTimer();
        }
        catch (e) {
            global.logError(e);
        }
    },

    on_applet_clicked: function(event) {
        this.menu.toggle();
    },

    _setTimerLabel: function(text) {
        this.set_applet_label(text);
    },

    // Add whatever options the timer needs to this submenu
    _buildOptionsMenu: function() {
        // Reset Counters Menu
        let resetButton =  new PopupMenu.PopupMenuItem(_('Reset Counts and Timer'));
        this._optionsMenu.menu.addMenuItem(resetButton);
        resetButton.actor.tooltip_text = "Click to reset session and break counts to zero";
        resetButton.connect('activate', Lang.bind(this, this._resetCount));

        let notificationSection = new PopupMenu.PopupMenuSection();
        this._optionsMenu.menu.addMenuItem(notificationSection);

        // Dialog Message toggle
        let showCountdownTimerToggle = new PopupMenu.PopupSwitchMenuItem
            (_("Show Countdown Timer"), this._showCountdownTimer);
        showCountdownTimerToggle.connect("toggled", Lang.bind(this, function() {
            this._showCountdownTimer = !(this._showCountdownTimer);
            this._onConfigUpdate(false);
        }));
        showCountdownTimerToggle.actor.tooltip_text = "Make the pomodoro timer count down to zero";
        notificationSection.addMenuItem(showCountdownTimerToggle);

        // ShowMessages option toggle
        let showNotificationMessagesToggle = new PopupMenu.PopupSwitchMenuItem(_("Show Notification Messages"), this._showNotificationMessages);
        showNotificationMessagesToggle.connect("toggled", Lang.bind(this, function() {
            this._showNotificationMessages = !(this._showNotificationMessages);
            this._onConfigUpdate(false);
        }));
        showNotificationMessagesToggle.actor.tooltip_text = "Show notification messages in the gnome-shell taskbar";
        notificationSection.addMenuItem(showNotificationMessagesToggle);

        // Dialog Message toggle
        let breakMessageToggle = new PopupMenu.PopupSwitchMenuItem
            (_("Show Dialog Messages"), this._showDialogMessages);
        breakMessageToggle.connect("toggled", Lang.bind(this, function() {
            this._showDialogMessages = !(this._showDialogMessages);
            this._onConfigUpdate(false);
        }));
        breakMessageToggle.actor.tooltip_text = "Show a dialog message at the end of pomodoro session";
        notificationSection.addMenuItem(breakMessageToggle);

        // Notify with a sound
        let playSoundToggle = new PopupMenu.PopupSwitchMenuItem
            (_("Sound Notifications"), this._playSound);
        playSoundToggle.connect("toggled", Lang.bind(this, function() {
            this._playSound = !(this._playSound);
            this._onConfigUpdate(false);
        }));
        playSoundToggle.actor.tooltip_text = "Play a sound at start of pomodoro session";
        this._optionsMenu.menu.addMenuItem(playSoundToggle);

        // Pomodoro Duration section
        let timerLengthSection = new PopupMenu.PopupMenuSection();
        this._optionsMenu.menu.addMenuItem(timerLengthSection);

        let item = new PopupMenu.PopupMenuItem(_("Pomodoro Duration"), { reactive: false });
        this._pomodoroTimeLabel = new St.Label({ text: this._formatTime(this._pomodoroTime) });
        item.addActor(this._pomodoroTimeLabel, { align: St.Align.END });
        timerLengthSection.addMenuItem(item);

        this._pomodoroTimeSlider = new PopupMenu.PopupSliderMenuItem(this._pomodoroTime/3600);
        this._pomodoroTimeSlider.connect('value-changed', Lang.bind(this, function() {
            this._pomodoroTime = Math.ceil(Math.ceil(this._pomodoroTimeSlider._value * 3600)/60)*60;
            this._pomodoroTimeLabel.set_text(this._formatTime(this._pomodoroTime));
            this._onConfigUpdate(true);
        } ));
        timerLengthSection.addMenuItem(this._pomodoroTimeSlider);

        // Short Break Duration menu
        item = new PopupMenu.PopupMenuItem(_("Short Break Duration"), { reactive: false });
        this._sBreakTimeLabel = new St.Label({ text: this._formatTime(this._shortPauseTime) });
        item.addActor(this._sBreakTimeLabel, { align: St.Align.END });
        timerLengthSection.addMenuItem(item);

        this._sBreakTimeSlider = new PopupMenu.PopupSliderMenuItem(this._shortPauseTime/720);
        this._sBreakTimeSlider.connect('value-changed', Lang.bind(this, function() {
            this._shortPauseTime = Math.ceil(Math.ceil(this._sBreakTimeSlider._value * 720)/60)*60;
            this._sBreakTimeLabel.set_text(this._formatTime(this._shortPauseTime));
            this._onConfigUpdate(true);
        } ));
        timerLengthSection.addMenuItem(this._sBreakTimeSlider);

        // Long Break Duration menu
        item = new PopupMenu.PopupMenuItem(_("Long Break Duration"), { reactive: false });
        this._lBreakTimeLabel = new St.Label({ text: this._formatTime(this._longPauseTime) });
        item.addActor(this._lBreakTimeLabel, { align: St.Align.END });
        timerLengthSection.addMenuItem(item);

        this._lBreakTimeSlider = new PopupMenu.PopupSliderMenuItem(this._longPauseTime/2160);
        this._lBreakTimeSlider.connect('value-changed', Lang.bind(this, function() {
            this._longPauseTime = Math.ceil(Math.ceil(this._lBreakTimeSlider._value * 2160)/60)*60;
            this._lBreakTimeLabel.set_text(this._formatTime(this._longPauseTime));
            this._onConfigUpdate(true);
        } ));
        timerLengthSection.addMenuItem(this._lBreakTimeSlider);
    },

    _createDialogWindow: function() {
        this._dialog = new ModalDialog.ModalDialog({ style_class: 'polkit-dialog' });

        let mainContentBox = new St.BoxLayout({
            style_class: 'polkit-dialog-main-layout',
            vertical: false
        });

        this._dialog.contentLayout.add(mainContentBox, {
            x_fill: true,
            y_fill: true
        });

        let messageBox = new St.BoxLayout({
            style_class: 'polkit-dialog-message-layout',
            vertical: true
        });

        mainContentBox.add(messageBox, {
            y_align: St.Align.START
        });

        this._subjectLabel = new St.Label({
            style_class: 'polkit-dialog-headline',
            text: _("Pomodoro Finished!")
        });

        messageBox.add(this._subjectLabel, {
            y_fill:  false,
            y_align: St.Align.START
        });

        this._descriptionLabel = new St.Label({
                style_class: 'polkit-dialog-description',
                text: '' }
        );
        this._descriptionLabel.clutter_text.ellipsize = Pango.EllipsizeMode.NONE;
        this._descriptionLabel.clutter_text.line_wrap = true;

        messageBox.add(this._descriptionLabel, {
            y_fill:  true,
            y_align: St.Align.START
        });

        this._dialog.contentLayout.add(this._descriptionLabel, {
            x_fill: true,
            y_fill: true
        });

        this._dialog.setButtons([
            {
                label: _("Hide"),
                action: Lang.bind(this, function(param) {
                    this._dialog.close();
                    this._notifyPomodoroEnd(_('Pomodoro finished, take a break!'), true);
                }),
                key: Clutter.Escape
            },
            {
                label: _("Start a new Pomodoro"),
                action: Lang.bind(this, function(param) {
                    this._startNewPomodoro();
                })
            }
        ]);
    },

    // Handles option changes in the UI, saves the configuration
    // Set _validateTimer_ to true in case internal timer states and related options are changed
    _onConfigUpdate: function(validateTimer) {
        if (validateTimer == true) {
            this._checkTimerState();
            this._updateTimer();
        }

        this._saveConfig();
    },

    // Skip break or reset current pomodoro
    _startNewPomodoro: function() {
        if (this._isPause)
            this._timeSpent = 99999;
        else
            this._timeSpent = 0;

        this._checkTimerState();
        this._updateTimer();
    },

    // Reset all counters and timers
    _resetCount: function() {
        this._timeSpent = 0;
        this._isPause = false;
        this._sessionCount = 0;
        this._pauseCount = 0;
        this._checkTimerState();
        this._updateTimer();
        return false;
    },

    _createNotificationSource: function() {
        let source = new MessageTray.SystemNotificationSource();
        source.setTitle(_('Pomodoro Timer'));
        Main.messageTray.add(source);
        return source;
    },

    // Notify user of changes
    _notifyPomodoroStart: function(text, force) {
        if (this._notification != null) {
            this._notification.destroy(MessageTray.NotificationDestroyedReason.SOURCE_CLOSED);
            this._notification = null;
        }
        this._dialog.close();

        if (this._showNotificationMessages) {
            let source = this._createNotificationSource ();
            this._notification = new MessageTray.Notification(source, text);
            this._notification.setTransient(true);

            source.notify(this._notification);
        }

        this._playNotificationSound();
    },

    // Notify user of changes
    _notifyPomodoroEnd: function(text, hideDialog) {
        if (this._notification != null) {
            this._notification.destroy(MessageTray.NotificationDestroyedReason.SOURCE_CLOSED);
            this._notification = null;
        }
        if (this._showNotificationMessages || hideDialog) {
            let source = this._createNotificationSource ();
            this._notification = new MessageTray.Notification(source, text, null);
            this._notification.setResident(true);
            this._notification.addButton(1, _('Start a new Pomodoro'));
            this._notification.connect('action-invoked', Lang.bind(this, function(param) {
                this._startNewPomodoro();
            })
            );
            source.notify(this._notification);
        }
        if (this._showDialogMessages && hideDialog != true)
            this._dialog.open();
    },

    // Plays a notification sound
    _playNotificationSound: function() {
        if (this._playSound) {
            let uri = GLib.filename_to_uri(appletDir + "/bell.wav", null);

            try {
                let gstPath = "gst-launch";
                if (GLib.find_program_in_path(gstPath) == null)
                    gstPath = GLib.find_program_in_path("gst-launch-0.10");
                if (gstPath != null)
                    Util.trySpawnCommandLine(gstPath + " --quiet playbin2 uri=" +
                        GLib.shell_quote(uri));
                else
                    this._playSound = false;
            } catch (err) {
                global.logError("Pomodoro: Error playing a sound: " + err.message);
                this._playSound = false;
            } finally {
                if (this._playSound == false)
                    global.logError("Pomodoro: Disabled sound.");
            }
        }
    },

    // Toggle timer state
    _toggleTimerState: function(item) {
        if (item != null) {
            this._stopTimer = item.state;
        }

        if (this._stopTimer == false) {
            this._stopTimer = true;
            this._isPause = false;
            this._setTimerLabel("[%02d] 00:00".format(this._sessionCount));
        }
        else {
            this._timeSpent = -1;
            this._minutes = 0;
            this._seconds = 0;
            this._stopTimer = false;
            this._isPause = false;
            this._refreshTimer();
        }
        this._checkTimerState();
    },


    // Increment timeSpent and call functions to check timer states and update ui_timer
    _refreshTimer: function() {
        if (this._stopTimer == false) {
            this._timeSpent += 1;
            this._checkTimerState();
            this._updateTimer();
            Mainloop.timeout_add_seconds(1, Lang.bind(this, this._refreshTimer));
        }

        this._updateTimer();
        return false;
    },


    // Checks if timer needs to change state
    _checkTimerState: function() {
        if (this._stopTimer == false) {
            // Check if a pause is running..
            if (this._isPause == true) {
                // Check if the pause is over
                if (this._timeSpent >= this._pauseTime) {
                    this._timeSpent = 0;
                    this._isPause = false;
                    this._notifyPomodoroStart(_('Pause finished, a new pomodoro is starting!'));
                }
                else {
                    if (this._pauseCount == 0) {
                        this._pauseTime = this._longPauseTime;
                    } else {
                        this._pauseTime = this._shortPauseTime;
                    }
                }
            }
            // ..or if a pomodoro is running and a pause is needed :)
            else if (this._timeSpent >= this._pomodoroTime) {
                this._pauseCount += 1;
                this._pauseTime = this._shortPauseTime;

                // Check if it's time of a longer pause
                if (this._pauseCount == 4) {
                    this._pauseCount = 0;
                    this._pauseTime = this._longPauseTime;
                    this._notifyPomodoroEnd(_('4th pomodoro in a row finished, starting a long pause...'));
                }
                else {
                    this._notifyPomodoroEnd(_('Pomodoro finished, take a break!'));
                }

                this._timeSpent = 0;
                this._minutes = 0;
                this._seconds = 0;
                this._sessionCount += 1;
                this._isPause = true;

            }
        }
        this._updateSessionCount();
    },

    _updateSessionCount: function() {
        let text = '';

        if (this._sessionCount == 0 && this._stopTimer) {
            text = _('None');
        }
        else {
            if (this._isPause || this._stopTimer)
                text = Array((this._sessionCount-1) % 4 + 2).join('\u25cf'); // ● U+25CF BLACK CIRCLE
            else
                text = Array(this._sessionCount % 4 + 1).join('\u25cf') + '\u25d6'; // ◖ U+25D6 LEFT HALF BLACK CIRCLE
        }
        this._sessionCountLabel.set_text(text);
    },

    // Update timer_ui
    _updateTimer: function() {
        if (this._stopTimer == false) {
            let seconds = this._timeSpent;
            if (this._showCountdownTimer == true)
                seconds = (this._isPause ? this._pauseTime : this._pomodoroTime) - this._timeSpent;

            this._minutes = parseInt(seconds / 60);
            this._seconds = parseInt(seconds % 60);

            timer_text = "[%02d] %02d:%02d".format(this._sessionCount, this._minutes, this._seconds);
            this._setTimerLabel(timer_text);

            if (this._isPause && this._showDialogMessages)
            {
                seconds = this._pauseTime - this._timeSpent;
                if (seconds < 47)
                    this._descriptionLabel.text = _("Take a break! You have %d seconds\n").format(Math.round(seconds / 5) * 5);
                else
                    this._descriptionLabel.text = _("Take a break! You have %d minutes\n").format(Math.round(seconds / 60));
            }
        }
    },

    // Format absolute time in seconds as "Xm Ys"
    _formatTime: function(abs) {
        let minutes = Math.floor(abs/60);
        let seconds = abs - minutes*60;
        return _("%d minutes").format(minutes);
    },

    _parseConfig: function() {
        // Set the default values
        for (let i = 0; i < configOptions.length; i++)
            this[configOptions[i][0]] = configOptions[i][3];

        if (GLib.file_test(configFilePath, GLib.FileTest.EXISTS)) {
            let filedata = null;

            try {
                filedata = Cinnamon.get_file_contents_utf8_sync(configFilePath);
                global.log("Pomodoro: Using config file = " + configFilePath);

                let jsondata = JSON.parse(filedata);

                for (let i = 0; i < configOptions.length; i++) {
                    let option = configOptions[i];
                    if (jsondata.hasOwnProperty(option[1]) && jsondata[option[1]].hasOwnProperty(option[2])) {
                        // The option "category" and the actual option is defined in config file,
                        // override it!
                        this[option[0]] = jsondata[option[1]][option[2]];
                    }
                }
            }
            catch (e) {
                global.logError("Pomodoro: Error reading config file " + configFilePath + ", error = " + e);
            }
            finally {
                filedata = null;
            }
        }
    },

    _saveConfig: function() {
        let filedata = null;
        let jsondata = {};

        try {
            for (let i = 0; i < configOptions.length; i++) {
                let option = configOptions[i];
                // Insert the option "category", if it's undefined
                if (jsondata.hasOwnProperty(option[1]) == false) {
                    jsondata[option[1]] = {};
                }

                // Update the option key/value pairs
                jsondata[option[1]][option[2]] = this[option[0]];
            }
            filedata = JSON.stringify(jsondata, null, "  ");
            GLib.file_set_contents(configFilePath, filedata, filedata.length);
        }
        catch (e) {
            global.logError("Pomodoro: Error writing config file = " + e);
        }
        finally {
            jsondata = null;
            filedata = null;
        }
        global.log("Pomodoro: Updated config file = " + configFilePath);
    }
};

function main(metadata, orientation, panel_height) {
    let myApplet = new MyApplet(orientation, panel_height);
    return myApplet;
}