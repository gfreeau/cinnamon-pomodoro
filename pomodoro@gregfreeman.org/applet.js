const Main = imports.ui.main;
const Applet = imports.ui.applet;
const St = imports.gi.St;
const Clutter = imports.gi.Clutter;
const Lang = imports.lang;
const ModalDialog = imports.ui.modalDialog;
const PopupMenu = imports.ui.popupMenu;
const Settings = imports.ui.settings;

// set in main()
let TimerModule;
let SoundModule;

function main(metadata, orientation, panelHeight, instanceId) {
    let myModule = imports.ui.appletManager.applets[metadata.uuid];
    TimerModule = myModule.timer;
    SoundModule = myModule.sound;

    let myApplet = new PomodoroApplet(metadata, orientation, panelHeight, instanceId);

    return myApplet;
}

function PomodoroApplet(metadata, orientation, panelHeight, instanceId) {
    this._init.call(this, metadata, orientation, panelHeight, instanceId);
}

PomodoroApplet.prototype = {
    __proto__: Applet.TextIconApplet.prototype,

    _init: function(metadata, orientation, panelHeight, instanceId) {
        Applet.TextIconApplet.prototype._init.call(this, orientation, panelHeight, instanceId);

        this._metadata = metadata;

        this._setTimerLabel(0);

        this._settingsProvider = new Settings.AppletSettings(this, metadata.uuid, instanceId);
        this._bindSettings();

        this._dialog = this._createDialog();
        this._timerQueue = this._createTimerQueue();
        this._menu = this._createMenu(orientation);
    },

    _bindSettings: function() {
        this._settingsProvider.bindProperty(Settings.BindingDirection.IN,
            "pomodoro_duration", "_pomodoroTime", this.on_setting_pomodoro_duration_changed, null);

        this._settingsProvider.bindProperty(Settings.BindingDirection.IN,
            "pomodori_number", "_pomodoriNumber", this.on_settings_changed, null);

        this._settingsProvider.bindProperty(Settings.BindingDirection.IN,
            "short_break_duration", "_shortPauseTime", this.on_short_break_duration_changed, null);

        this._settingsProvider.bindProperty(Settings.BindingDirection.IN,
            "long_break_duration", "_longPauseTime", this.on_long_break_duration_changed, null);

        this._settingsProvider.bindProperty(Settings.BindingDirection.IN,
            "show_dialog_messages", "_showDialogMessages", this.on_settings_changed, null);

        this._settingsProvider.bindProperty(Settings.BindingDirection.IN,
            "auto_start_after_break_ends", "_autoStartAfterBreak", this.on_settings_changed, null);

        this._settingsProvider.bindProperty(Settings.BindingDirection.IN,
            "display_icon", "_displayIcon", this.on_icon_changed, null);

        this._settingsProvider.bindProperty(Settings.BindingDirection.IN,
            "break_sound", "play_break_sound", this.on_settings_changed, null);

        this._settingsProvider.bindProperty(Settings.BindingDirection.IN,
            "break_sound_file", "break_sound_filepath", this.on_break_sound_file_changed, null);

        this._settingsProvider.bindProperty(Settings.BindingDirection.IN,
            "timer_sound", "play_timer_sound", this.on_play_timer_sound_changed, null);

        this._settingsProvider.bindProperty(Settings.BindingDirection.IN,
            "timer_sound_file", "timer_sound_filepath", this.on_timer_sound_file_changed, null);

        this._settingsProvider.bindProperty(Settings.BindingDirection.IN,
            "warn_sound", "play_warn_sound", this.on_settings_changed, null);

        this._settingsProvider.bindProperty(Settings.BindingDirection.IN,
            "warn_sound_delay", "warn_sound_delay", this.on_settings_changed, null);

        this._settingsProvider.bindProperty(Settings.BindingDirection.IN,
            "warn_sound_file", "warn_sound_filepath", this.on_warn_sound_file_changed, null);
    },

    _setTimerLabel: function(ticks, completed) {
        ticks = ticks || 0;
        completed = completed || 0;

        let minutes, seconds;
        minutes = seconds = 0;

        if (ticks > 0) {
            minutes = parseInt(ticks / 60);
            seconds = parseInt(ticks % 60);
        }

        let timerText = "%d\u00B7 ".format(completed);
        timerText += "%02d:%02d".format(Math.abs(minutes), Math.abs(seconds));

        this.set_applet_label(timerText);
    },

    /**
     *
     * @returns {imports.timer.TimerQueue}
     * @private
     */
    _createTimerQueue: function() {
        let timerQueue = new TimerModule.TimerQueue();

        timerQueue.connect('timer-queue-started', Lang.bind(this, function() {
            this._menu.startedPomodori();
        }));

        timerQueue.connect('timer-queue-finished', Lang.bind(this, function() {
            this._menu.finishedPomodori();
        }));

        var pomodoroTimer = new TimerModule.Timer({ name: 'pomodoro', timerLimit: 10 });
        var shortBreakTimer = new TimerModule.Timer({ name: 'short_break', timerLimit: 5 });
        var longBreakTimer = new TimerModule.Timer({ name: 'long_break', timerLimit: 15 });

        const APPLET_PATH = this._metadata.path;
        const NUM_POMODORI = 4;

        for (let i = 1; i < NUM_POMODORI + 1; i++) {
            timerQueue.addTimer(pomodoroTimer);

            if (i == NUM_POMODORI) {
                timerQueue.addTimer(longBreakTimer);
            } else {
                timerQueue.addTimer(shortBreakTimer);
            }
        }

        pomodoroTimer.connect('timer-tick', Lang.bind(this, this._timerTickUpdate));

        shortBreakTimer.connect('timer-tick', Lang.bind(this, this._timerTickUpdate));

        longBreakTimer.connect('timer-tick', Lang.bind(this, this._timerTickUpdate));
        //longBreakTimer.connect('timer-tick', Lang.bind(this._dialog, this._dialog.updateTimeRemaining));

        let soundTick = new SoundModule.SoundEffect(APPLET_PATH + "/sounds/tick.ogg");
        let soundFinish = new SoundModule.SoundEffect(APPLET_PATH + "/sounds/deskbell.wav");

        pomodoroTimer.connect('timer-started', Lang.bind(this, function() {
            Main.notify('pomodoro started');
        }));

        pomodoroTimer.connect('timer-running', Lang.bind(this, function() {
            soundTick.play({ loop: true });
        }));

        pomodoroTimer.connect('timer-stopped', Lang.bind(this, function() {
            soundTick.stop();
        }));

        pomodoroTimer.connect('timer-finished', Lang.bind(this, function() {
            soundFinish.play();
        }));

        shortBreakTimer.connect('timer-started', Lang.bind(this, function() {
            Main.notify('break started');
        }));

        longBreakTimer.connect('timer-started', Lang.bind(this, function() {
            this._dialog.open();
        }));

        return timerQueue;
    },

    _startNewPomodoro: function() {
        this._timerQueue.reset();
        this._timerQueue.start();
    },

    /**
     *
     * @param {imports.timer.Timer} timer
     * @private
     */
    _timerTickUpdate: function(timer) {
        this._setTimerLabel(timer.getTicksRemaining());
    },

    /**
     *
     * @returns {PomodoroMenu}
     * @private
     */
    _createMenu: function(orientation) {
        let menuManager = new PopupMenu.PopupMenuManager(this);
        let menu = new PomodoroMenu(this, orientation);

        menu.connect('start-timer', Lang.bind(this, function() {
            this._startNewPomodoro();
        }));

        menu.connect('stop-timer', Lang.bind(this, function() {
            this._timerQueue.stop();
        }));

        menu.connect('reset-all', Lang.bind(this, function() {
            this.resetPomodoriCount();
            this._timerQueue.reset();
        }));

        menu.connect('reset-timer', Lang.bind(this, function() {
            this._timerQueue.reset();
        }));

        menu.connect('show-settings', Lang.bind(this, function() {
            let command = "cinnamon-settings applets %s".format(this._metadata.uuid);
            Util.trySpawnCommandLine(command);
        }));

        menuManager.addMenu(menu);

        return menu;
    },

    /**
     *
     * @returns {PomodoroFinishedDialog}
     * @private
     */
    _createDialog: function() {
        let dialog = new PomodoroFinishedDialog();

        dialog.connect('switch-off-pomodoro', Lang.bind(this, function() {
            this._dialog.close();
            this._menu.toggleTimerState(false);
        }));

        dialog.connect('start-new-pomodoro', Lang.bind(this, function() {
            this._startNewPomodoro();
            this._dialog.close();
        }));

        dialog.connect('hide', Lang.bind(this, function() {
            this._dialog.close();
        }));

        return dialog;
    },

    // Setting listeners

    on_setting_pomodoro_duration_changed: function() {

    },

    on_settings_changed: function() {

    },

    on_icon_changed: function() {

    },

    on_short_break_duration_changed: function() {

    },

    on_long_break_duration_changed: function() {

    },

    on_break_sound_file_changed: function() {

    },

    on_play_timer_sound_changed: function() {

    },

    on_timer_sound_file_changed: function() {

    },

    on_warn_sound_file_changed: function() {

    },

    // Applet listeners

    on_applet_clicked: function() {
        this._menu.toggle();
    },

    on_applet_removed_from_panel: function() {
        this._timerQueue.stop();
        this._settingsProvider.finalize();
    }
};

function PomodoroMenu(launcher, orientation) {
    this._init.call(this, launcher, orientation);
}

PomodoroMenu.prototype = {
    __proto__: Applet.AppletPopupMenu.prototype,

    _init: function(launcher, orientation) {
        Applet.AppletPopupMenu.prototype._init.call(this, launcher, orientation);

        this._pomodoriCompleted = 0;

        this._addMenuItems();
        this.resetPomodoriCount();
    },

    _addMenuItems: function() {
        let toggleItem = new PopupMenu.PopupSwitchMenuItem(_("Pomodoro Timer"), false);
        this._timerToggle = toggleItem;

        toggleItem.connect("toggled", Lang.bind(this, function(menuItem, state) {
            state ? this.emit('start-timer') : this.emit('stop-timer');
        }));

        this.addMenuItem(toggleItem);

        let statsItem = new PopupMenu.PopupMenuItem(_("Collected"), { reactive: false });

        let bin = new St.Bin({ x_align: St.Align.END });
        this._pomodoriCountLabel = new St.Label();
        bin.add_actor(this._pomodoriCountLabel);
        statsItem.addActor(bin, { expand: true, span: -1, align: St.Align.END });

        this.addMenuItem(statsItem);

        let resetItem = new PopupMenu.PopupMenuItem(_('Reset Counts and Timer'));

        resetItem.connect('activate', Lang.bind(this, function() {
            this.resetPomodoriCount();
            this.emit('reset-all');
        }));

        this.addMenuItem(resetItem);

        let resetTimerItem = new PopupMenu.PopupMenuItem(_('Reset Timer'));

        resetTimerItem.connect('activate', Lang.bind(this, function() {
            this.emit('reset-timer');
        }));

        this.addMenuItem(resetTimerItem);

        let endTaskItem = new PopupMenu.PopupMenuItem(_('End Current Pomodoro'));

        endTaskItem.connect('activate', Lang.bind(this, function() {
            this.emit('end-pomodoro');
        }));

        this.addMenuItem(endTaskItem);

        let settingsItem = new PopupMenu.PopupMenuItem(_("Settings"));

        settingsItem.connect("activate", Lang.bind(this, function() {
            this.emit('show-settings');
        }));

        this.addMenuItem(settingsItem);
    },

    toggleTimerState: function() {
        this._timerToggle.toggle();
    },

    startedPomodori: function() {
        let text = '';

        if (this._pomodoriCompleted > 0) {
            let text = this._pomodoriCountLabel.get_text();
        }

        text += '\u25d6';

        this._pomodoriCountLabel.set_text(text);
    },

    finishedPomodori: function() {
        this._pomodoriCompleted++;
        this._drawPomodoriCount();
    },

    resetPomodoriCount: function() {
        this._pomodoriCompleted = 0;
        let text = _('None');

        this._pomodoriCountLabel.set_text(text);
    },

    _drawPomodoriCount: function() {
        let text = Array(this._pomodoriCompleted + 1).join('\u25cf');

        this._pomodoriCountLabel.set_text(text);
    },
};

function PomodoroFinishedDialog() {
    this._init.call(this);
}

PomodoroFinishedDialog.prototype = {
    __proto__: ModalDialog.ModalDialog.prototype,

    _init: function() {
        ModalDialog.ModalDialog.prototype._init.call(this);

        let subjectLabel = new St.Label({
            text: _("Pomodoro finished, you deserve a break!")
        });

        this.contentLayout.add(subjectLabel);

        let space = new St.Label({text: " "});
        this.contentLayout.add(space);

        this._timeLabel = new St.Label();

        this.setButtons([
            {
                label: _("Switch Off Pomodoro"),
                action: Lang.bind(this, function() {
                    this.emit('switch-off-pomodoro');
                })
            },
            {
                label: _("Start a new Pomodoro"),
                action: Lang.bind(this, function() {
                    this.emit('start-new-pomodoro')
                })
            },
            {
                label: _("Hide"),
                action: Lang.bind(this, function() {
                    this.emit('hide');
                }),
                key: Clutter.Escape
            }
        ]);
    },

    updateTimeRemaining: function(timer) {
        let tickCount = timer.getTicksRemaining();
        this._timeLabel.set_text(_("Time remaining: ") + tickCount);
    }
};
