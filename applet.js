const Applet = imports.ui.applet;
const Lang = imports.lang;
const Mainloop = imports.mainloop;
const Settings = imports.ui.settings;
const Util = imports.misc.util;
const Main = imports.ui.main;
const PopupMenu = imports.ui.popupMenu;
const MessageTray = imports.ui.messageTray;
const ModalDialog = imports.ui.modalDialog;
const St = imports.gi.St;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Clutter = imports.gi.Clutter;
const Pango = imports.gi.Pango;

const appletUUID = 'pomodoro@gregfreeman.org';
const appletPath = imports.ui.appletManager._find_applet(appletUUID).get_path();


function MyApplet(orientation, panel_height, instance_id) {
    this._init(orientation, panel_height, instance_id);
}

MyApplet.prototype = {
    __proto__: Applet.TextIconApplet.prototype,

    _init: function(orientation, panel_height, instance_id) {
        Applet.TextIconApplet.prototype._init.call(this, orientation, panel_height, instance_id);

        this._timeSpent = -1; // time spent in seconds, used to check if pomodoro time or break time is over
        this._minutes = 0; // used to display the minuts spent of pomodoro time
        this._seconds = 0; // used to display the seconds spent of pomodoro time
        this._stopTimer = true; // defined if pomodoro timer is running or not
        this._isPause = false; // defined if break time is in progress or not
        this._pauseTime = 0; // duration of a break timein seconds, may vary between short and long break
        this._pauseCount = 0; // Number of short pauses so far. Reset every 4 pauses.
        this._sessionCount = 0; // Number of pomodoro sessions completed so far!
        this._notification = null; // the last notification, kept in a variable to delete it when a new one is created
        this._dialog = null; // the modal dialog window, used to close and open it
        this._askStart = false; // defined if the user explicitly ask for a new pomodoro, used if _autoStartAfterBreak is set to false

        this._timerSound = GLib.shell_quote(appletPath + '/EggTimer.ogg');
        this._breakSound = GLib.shell_quote(appletPath + '/deskbell.wav');
        this._warnSound = GLib.shell_quote(appletPath + '/warn.wav');

        this._setTimerLabel("0\u00B7 00:00");

        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager.addMenu(this.menu);

        this.settings = new Settings.AppletSettings(this, appletUUID, instance_id);
        this._bindSettings();
        
        if (this._displayIcon)
            this.set_applet_icon_path(appletPath + "/icon.png");

        // convert settings values stored in minutes into seconds
        this._convertPomodoroDurationToSeconds();
        this._convertShortBreakDurationToSeconds();
        this._convertLongBreakDurationToSeconds();

        this._createPanelMenu();

        // creates the modal dialog window
        this._createDialogWindow();

        // Start the timer
        this._refreshTimer();
    },
    
    _bindSettings: function() {
        this.settings.bindProperty(Settings.BindingDirection.IN,
            "pomodoro_duration", "_pomodoroTime", this.on_pomodoro_duration_changed, null); 

        this.settings.bindProperty(Settings.BindingDirection.IN,
            "short_break_duration", "_shortPauseTime", this.on_short_break_duration_changed, null); 

        this.settings.bindProperty(Settings.BindingDirection.IN,
            "long_break_duration", "_longPauseTime", this.on_long_break_duration_changed, null); 

        this.settings.bindProperty(Settings.BindingDirection.IN,
            "show_countdown_timer", "_showCountdownTimer", this.on_settings_changed, null); 

        this.settings.bindProperty(Settings.BindingDirection.IN, 
            "show_notification_messages", "_showNotificationMessages", this.on_settings_changed, null); 

        this.settings.bindProperty(Settings.BindingDirection.IN,
            "show_dialog_messages", "_showDialogMessages", this.on_settings_changed, null);
            
        this.settings.bindProperty(Settings.BindingDirection.IN,
            "auto_start_after_break_ends", "_autoStartAfterBreak", this.on_settings_changed, null);
            
        this.settings.bindProperty(Settings.BindingDirection.IN,
            "display_icon", "_displayIcon", this.on_icon_changed, null);
        
        this.settings.bindProperty(Settings.BindingDirection.IN,
            "break_sound", "play_break_sound", this.on_settings_changed, null);
        
        this.settings.bindProperty(Settings.BindingDirection.IN,
            "break_sound_file", "break_sound_filepath", this.on_break_sound_file_changed, null);
        
        this.settings.bindProperty(Settings.BindingDirection.IN,
            "timer_sound", "play_timer_sound", this.on_play_timer_sound_changed, null);
        
        this.settings.bindProperty(Settings.BindingDirection.IN,
            "timer_sound_file", "timer_sound_filepath", this.on_timer_sound_file_changed, null);
            
        this.settings.bindProperty(Settings.BindingDirection.IN,
            "warn_sound", "play_warn_sound", this.on_settings_changed, null);
            
        this.settings.bindProperty(Settings.BindingDirection.IN,
            "warn_sound_delay", "warn_sound_delay", this.on_settings_changed, null);
        
        this.settings.bindProperty(Settings.BindingDirection.IN,
            "warn_sound_file", "warn_sound_filepath", this.on_warn_sound_file_changed, null);
    },

    _createPanelMenu: function() {
        this._timerToggle = new PopupMenu.PopupSwitchMenuItem(_("Pomodoro Timer"), false);
        this._timerToggle.connect("toggled", Lang.bind(this, this._toggleTimerState));
        this.menu.addMenuItem(this._timerToggle);

        let statsItem = new PopupMenu.PopupMenuItem("Collected", { reactive: false });
        let bin = new St.Bin({ x_align: St.Align.END });
        this._sessionCountLabel = new St.Label({ text: "None" });
        bin.add_actor(this._sessionCountLabel);
        statsItem.addActor(bin, { expand: true, span: -1, align: St.Align.END });
        this.menu.addMenuItem(statsItem);

        let resetItem = new PopupMenu.PopupMenuItem(_('Reset Counts and Timer'));
        resetItem.connect('activate', Lang.bind(this, this._resetCount));
        this.menu.addMenuItem(resetItem);
        
        let resetTimerItem = new PopupMenu.PopupMenuItem(_('Reset Timer'));
        resetTimerItem.connect('activate', Lang.bind(this, this._resetTimer));
        this.menu.addMenuItem(resetTimerItem);
        
        let endTaskItem = new PopupMenu.PopupMenuItem(_('End Current Pomodoro'));
        endTaskItem.connect('activate', Lang.bind(this, this._endTask));
        this.menu.addMenuItem(endTaskItem);

        let settingsItem = new PopupMenu.PopupMenuItem("Settings");
        settingsItem.connect("activate", Lang.bind(this, function() {
            Util.trySpawnCommandLine("cinnamon-settings applets " + appletUUID);
        }));
        this.menu.addMenuItem(settingsItem);
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
            y_fill: false,
            y_align: St.Align.START
        });

        this._descriptionLabel = new St.Label({
            style_class: 'polkit-dialog-description',
            text: '' }
        );
        this._descriptionLabel.clutter_text.ellipsize = Pango.EllipsizeMode.NONE;
        this._descriptionLabel.clutter_text.line_wrap = true;

        messageBox.add(this._descriptionLabel, {
            y_fill: true,
            y_align: St.Align.START
        });

        this._dialog.contentLayout.add(this._descriptionLabel, {
            x_fill: true,
            y_fill: true
        });

        this._dialog.setButtons([
            {
                label: _("Switch Off Pomodoro"),
                action: Lang.bind(this, function(param) {
                    this._dialog.close();
                    this._timerToggle.setToggleState(false);
                    this._toggleTimerState(this._timerToggle);
                })
            },
            {
                label: _("Start a new Pomodoro"),
                action: Lang.bind(this, function(param) {
                    this._startNewPomodoro();
                })
            },
            {
                label: _("Hide"),
                action: Lang.bind(this, function(param) {
                    this._dialog.close();
                    this._notifyPomodoroEnd(_('Pomodoro finished, take a break!'), true);
                }),
                key: Clutter.Escape
            }
        ]);
    },

    // Skip break or reset current pomodoro
    _startNewPomodoro: function() {
        if (this._isPause) {
            this._askStart = true;
            this._timeSpent = 99999;
        }
        else
            this._timeSpent = 0;

        this._checkTimerState();
        this._updateTimer();
    },

    // Reset all counters and timers
    _resetCount: function() {
        // allow to reset counters and timer only outside of a break
        // because there is no sense to reset during a break
        // and reset restarts the timer and the timer sound is not played here
        if (!this._isPause) {
            this._timeSpent = 0;
            this._sessionCount = 0;
            this._pauseCount = 0;
            this._checkTimerState(); // in that case reset the Collected field
            this._updateTimer();
        }
    },
    
    // Reset the current running timer
    _resetTimer: function() {       
        if (!this._stopTimer && !this._isPause) {
            this._timeSpent = 0;
            this._updateTimer();
        }
    },
    
    _endTask: function() {       
        if (!this._stopTimer && !this._isPause) {
            this._timeSpent = 99999;
            this._checkTimerState();
        }
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

        this._playTimerSound();
    },

    // Notify user of changes
    _notifyPomodoroEnd: function(text, hideDialog) {
        if (this._notification != null) {
            this._notification.destroy(MessageTray.NotificationDestroyedReason.SOURCE_CLOSED);
            this._notification = null;
        }
        
        if (this._showNotificationMessages || hideDialog) {
            let source = this._createNotificationSource();
            this._notification = new MessageTray.Notification(source, text, null);
            this._notification.setResident(true);
            this._notification.addButton(1, _('Start a new Pomodoro'));
            this._notification.connect('action-invoked', Lang.bind(this, function(param) {
                this._startNewPomodoro(); })
            );
            source.notify(this._notification);
        }
        
        if (this._showDialogMessages && !hideDialog)
            this._dialog.open();
    },
    
    _playSound: function(soundPath, args) {
        if (GLib.find_program_in_path('play') != null) {
            Util.trySpawnCommandLine("play -q " + soundPath + " " + args);
        }
        else {
            global.logError("Pomodoro: Unable to find the 'play' binary. Check 'sox' is well installed.");
        }
    },
    
    _playTimerSound: function() {
        if (this.play_timer_sound)
            this._playSound(this._timerSound, "repeat 9999");
    },
    
    _stopTimerSound: function() {
        if (GLib.find_program_in_path('pkill') != null) {
            Util.trySpawnCommandLine("pkill play");
        }
        else {
            global.logError("Pomodoro: Unable to find the 'pkill' binary.");
        }
    },
    
    _playBreakSound: function() {
        if (this.play_break_sound)
            this._playSound(this._breakSound, "");
    },

    // Toggle timer state
    _toggleTimerState: function(item) {
        // item is a PopupSwitchMenuItem
        // item.state is the state of the PopupSwitchMenuItem: true or false

        if (item != null && !item.state) { // if the timer was on
            this._stopTimer = true;
            this._isPause = false;
            this._setTimerLabel("%d\u00B7 00:00".format(this._sessionCount));
            this._stopTimerSound();
        }
        else { // if the timer was off
            this._timeSpent = -1;
            this._minutes = 0;
            this._seconds = 0;
            this._stopTimer = false;
            this._isPause = false;
            this._refreshTimer();
            this._playTimerSound();
        }
        
        this._checkTimerState();
    },

    // Increment timeSpent and call functions to check timer states and update ui_timer
    _refreshTimer: function() {
        if (!this._stopTimer) {
            this._timeSpent += 1;
            this._checkTimerState();
            this._updateTimer();
            Mainloop.timeout_add_seconds(1, Lang.bind(this, this._refreshTimer));
        }
    },

    // Checks if timer needs to change state
    _checkTimerState: function() {
        if (!this._stopTimer) { // if timer is running
            if (this._isPause) { // if a pause is running
                if (this._timeSpent >= this._pauseTime) { // if the pause is over
                    if (this._autoStartAfterBreak || this._askStart) {
                        this._timeSpent = 0;
                        this._isPause = false;
                        this._askStart = false;
                        this._notifyPomodoroStart(_('Pause finished, a new pomodoro is starting!'));
                    }
                }
            }
            else { // if a pomodoro is running
                if (this.play_warn_sound && (this._pomodoroTime - this._timeSpent) == this.warn_sound_delay) { // if a pomodoro is running and warn sound is activated
                    this._playSound(this._warnSound, "");
                }
                
                if (this._timeSpent >= this._pomodoroTime) { // if a pomodoro is running and a pause is needed :)
                    this._pauseCount += 1;
                    
                    // Check if it's time of a longer pause
                    if (this._pauseCount == 4) {
                        this._pauseCount = 0;
                        this._pauseTime = this._longPauseTime;
                        this._notifyPomodoroEnd(_('4th pomodoro in a row finished, starting a long pause...'));
                    }
                    else {
                        this._pauseTime = this._shortPauseTime;
                        this._notifyPomodoroEnd(_('Pomodoro finished, take a break!'));
                    }

                    this._timeSpent = 0;
                    this._minutes = 0;
                    this._seconds = 0;
                    this._sessionCount += 1;
                    this._isPause = true;
                    
                    this._stopTimerSound();
                    this._playBreakSound();
                }
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
        let seconds = this._timeSpent;
        
        if (this._showCountdownTimer) // if timer is used in countdown mode
            seconds = (this._isPause ? this._pauseTime : this._pomodoroTime) - this._timeSpent;

        this._minutes = parseInt(seconds / 60);
        this._seconds = parseInt(seconds % 60);

        timer_text = "%d\u00B7 ".format(this._sessionCount);
        if (this._minutes < 0 || this._seconds < 0)
            timer_text += "-";
        timer_text += "%02d:%02d".format(Math.abs(this._minutes), Math.abs(this._seconds));
        this._setTimerLabel(timer_text);

        if (this._isPause && this._showDialogMessages)
        {
            let remaining_seconds = this._pauseTime - this._timeSpent;
            let remaining_minutes = parseInt(Math.abs(remaining_seconds) / 60);
            if (remaining_seconds < -59)
                this._descriptionLabel.text = _("You exceeded the break of %d minutes\n").format(remaining_minutes);
            else if (remaining_seconds < 0)
                this._descriptionLabel.text = _("You exceeded the break of %d seconds\n").format(Math.abs(remaining_seconds));
            else if (remaining_seconds < 60)
                this._descriptionLabel.text = _("Take a break! You have %d seconds\n").format(remaining_seconds);
            else
                this._descriptionLabel.text = _("Take a break! You have %d minutes\n").format(remaining_minutes);
        }
    },

    // Format absolute time in seconds as "Xm Ys"
    _formatTime: function(abs) {
        let minutes = Math.floor(abs/60);
        let seconds = abs - minutes*60;
        return _("%d minutes").format(minutes);
    },

    _setTimerLabel: function(text) {
        this.set_applet_label(text);
    },

    _resetTimerDurations: function() {
        this._checkTimerState();
        this._updateTimer();
    },

    _convertPomodoroDurationToSeconds: function() {
        this._pomodoroTime = this._pomodoroTime * 60;
    },

    _convertShortBreakDurationToSeconds: function() {
        this._shortPauseTime = this._shortPauseTime * 60;
    },

    _convertLongBreakDurationToSeconds: function() {
        this._longPauseTime = this._longPauseTime * 60;
    },

    on_applet_clicked: function(event) {
        this.menu.toggle();
    },

    on_settings_changed: function() {
    },

    on_pomodoro_duration_changed: function() {
        this._convertPomodoroDurationToSeconds();
    },

    on_short_break_duration_changed: function() {
        this._convertShortBreakDurationToSeconds();
    },

    on_long_break_duration_changed: function() {
        this._convertLongBreakDurationToSeconds();
    },
    
    // check if the new sound file is valid before setting it
    on_break_sound_file_changed: function() {       
        let gFile = Gio.file_new_for_path(this.break_sound_filepath);
        if(gFile.query_exists(null)) {
            this._breakSound = GLib.shell_quote(this.break_sound_filepath);
        }
    },

    on_play_timer_sound_changed: function() {
        if (this._stopTimer) {
            // timer is stopped -- do nothing
            return;
        }

        if (this.play_timer_sound) {
            this._playTimerSound();
        }
        else {
            this._stopTimerSound();
        }
    },
    
    // check if the new sound file is valid before setting it
    on_timer_sound_file_changed: function() {       
        let gFile = Gio.file_new_for_path(this.timer_sound_filepath);
        if(gFile.query_exists(null)) {
            this._timerSound = GLib.shell_quote(this.timer_sound_filepath);
        }
    },
    
    // check if the new sound file is valid before setting it
    on_warn_sound_file_changed: function() {       
        let gFile = Gio.file_new_for_path(this.warn_sound_filepath);
        if(gFile.query_exists(null)) {
            this._warnSound = GLib.shell_quote(this.warn_sound_filepath);
        }
    },
    
    on_icon_changed: function() {
        if (this._displayIcon)
            this.set_applet_icon_path(appletPath + "/icon.png");
        else if (this._applet_icon_box.child)
            this._applet_icon_box.child.destroy();
    },

    on_applet_removed_from_panel: function() {
        this.settings.finalize();
    }
};

function main(metadata, orientation, panel_height, instance_id) {
    let myApplet = new MyApplet(orientation, panel_height, instance_id);
    return myApplet;
}
