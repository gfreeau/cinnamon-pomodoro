const Main = imports.ui.main;
const Applet = imports.ui.applet;
const St = imports.gi.St;
const Clutter = imports.gi.Clutter;
const Lang = imports.lang;
const ModalDialog = imports.ui.modalDialog;
const PopupMenu = imports.ui.popupMenu;
const Settings = imports.ui.settings;
const Util = imports.misc.util;

// set in main()
let TimerModule;
let SoundModule;

// this function is useful for development of the applet
// as we can quickly disable long running settings for quick tuning
// i.e a setting of 25 in the options can mean 25 seconds if we comment out the '* 60'
// makes it easy to test all of the timers quickly
function convertMinutesToSeconds(minutes) {
    return minutes * 60;
}

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

        this._numPomodoroFinished = 0;
        this._setTimerLabel(0);

        // option settings, values are bound in _bindSettings
        // using _opt prefix to make them easy to identify
        this._opt_pomodoroTimeMinutes = null;
        this._opt_shortBreakTimeMinutes = null;
        this._opt_longBreakTimeMinutes = null;
        this._opt_pomodoriNumber = null;
        this._opt_showDialogMessages = null;
        this._opt_autoStartNewAfterFinish = null;
        this._opt_displayIconInPanel = null;
        this._opt_playTickerSound = null;
        this._opt_tickerSoundPath = null;
        this._opt_playBreakSound = null;
        this._opt_breakSoundPath = null;
        this._opt_playWarnSound = null;
        this._opt_warnSoundDelay = null;
        this._opt_warnSoundPath = null;

        this._settingsProvider = new Settings.AppletSettings(this, metadata.uuid, instanceId);
        this._bindSettings();

        this._defaultSoundPath = metadata.path + '/sounds';

        this._sounds = {};
        this._loadSoundEffects();

        // If cinnamon crashes or restarts, we want to make sure no zombie sounds are still looping
        let killLoopingSoundCommand = 'python %s %s'.format(metadata.path + '/bin/kill-looping-sound.py', this._sounds.tick.getSoundPath());
        Util.trySpawnCommandLine(killLoopingSoundCommand);

        this._timers = {
            pomodoro: new TimerModule.Timer({ timerLimit: convertMinutesToSeconds(this._opt_pomodoroTimeMinutes) }),
            shortBreak: new TimerModule.Timer({ timerLimit: convertMinutesToSeconds(this._opt_shortBreakTimeMinutes) }),
            longBreak: new TimerModule.Timer({ timerLimit: convertMinutesToSeconds(this._opt_longBreakTimeMinutes) })
        };

        this._timerQueue = new TimerModule.TimerQueue();
        this._resetPomodoroTimerQueue();

        this._longBreakdialog = this._createLongBreakDialog();
        this._appletMenu = this._createMenu(orientation);

        this._connectTimerSignals();

        // trigger for initial setting
        this._onAppletIconChanged();
    },

    _bindSettings: function() {
        this._settingsProvider.bindProperty(
            Settings.BindingDirection.IN,
            "pomodoro_duration",
            "_opt_pomodoroTimeMinutes",
            function() {
                let timeInSeconds = convertMinutesToSeconds(this._opt_pomodoroTimeMinutes);
                this._timers.pomodoro.setTimerLimit(timeInSeconds);
            }
        );

        this._settingsProvider.bindProperty(
            Settings.BindingDirection.IN,
            "short_break_duration",
            "_opt_shortBreakTimeMinutes",
            function() {
                let timeInSeconds = convertMinutesToSeconds(this._opt_shortBreakTimeMinutes);
                this._timers.shortBreak.setTimerLimit(timeInSeconds);
            }
        );

        this._settingsProvider.bindProperty(
            Settings.BindingDirection.IN,
            "long_break_duration",
            "_opt_longBreakTimeMinutes",
            function() {
                let timeInSeconds = convertMinutesToSeconds(this._opt_longBreakTimeMinutes);
                this._timers.longBreak.setTimerLimit(timeInSeconds);
            }
        );

        this._settingsProvider.bindProperty(
            Settings.BindingDirection.IN,
            "pomodori_number",
            "_opt_pomodoriNumber",
            function() {
                // only take effect if the timer isn't currently running
                // otherwise wait until next pomodoro to take effect

                if (this._timerQueue.isRunning()) {
                    this.__pomodoriNumberChangedWhileRunning = true;
                    return;
                }

                this._resetPomodoroTimerQueue();
            }
        );

        this._settingsProvider.bindProperty(
            Settings.BindingDirection.IN,
            "show_dialog_messages",
            "_opt_showDialogMessages"
        );

        this._settingsProvider.bindProperty(
            Settings.BindingDirection.IN,
            "auto_start_after_break_ends",
            "_opt_autoStartNewAfterFinish"
        );

        this._settingsProvider.bindProperty(
            Settings.BindingDirection.IN,
            "display_icon",
            "_opt_displayIconInPanel",
            this._onAppletIconChanged
        );

        this._settingsProvider.bindProperty(
            Settings.BindingDirection.IN,
            "timer_sound",
            "_opt_playTickerSound",
            this._onPlayTickedSoundChanged
        );

        this._settingsProvider.bindProperty(
            Settings.BindingDirection.IN,
            "timer_sound_file",
            "_opt_tickerSoundPath",
            function() {
                this.__soundEffectSettingsChanged = true;
            }
        );

        this._settingsProvider.bindProperty(
            Settings.BindingDirection.IN,
            "break_sound",
            "_opt_playBreakSound"
        );

        this._settingsProvider.bindProperty(
            Settings.BindingDirection.IN,
            "break_sound_file",
            "_opt_breakSoundPath",
            function() {
                this.__soundEffectSettingsChanged = true;
            }
        );

        this._settingsProvider.bindProperty(
            Settings.BindingDirection.IN,
            "warn_sound",
            "_opt_playWarnSound"
        );

        this._settingsProvider.bindProperty(
            Settings.BindingDirection.IN,
            "warn_sound_delay",
            "_opt_warnSoundDelay"
        );

        this._settingsProvider.bindProperty(
            Settings.BindingDirection.IN,
            "warn_sound_file",
            "_opt_warnSoundPath",
            function() {
                this.__soundEffectSettingsChanged = true;
            }
        );
    },

    _setTimerLabel: function(ticks) {
        ticks = ticks || 0;

        let minutes, seconds;
        minutes = seconds = 0;

        if (ticks > 0) {
            minutes = parseInt(ticks / 60);
            seconds = parseInt(ticks % 60);
        }

        let timerText = "%d\u00B7 ".format(this._numPomodoroFinished);
        timerText += "%02d:%02d".format(Math.abs(minutes), Math.abs(seconds));

        this.set_applet_label(timerText);
    },

    /**
     * Adds all of the timers to a queue,
     * takes into account the number of pomodori per round
     * is called every time a new pomodoro is started
     * @private
     */
    _resetPomodoroTimerQueue: function() {
        this._timerQueue.clear();

        for (let i = 1; i < this._opt_pomodoriNumber + 1; i++) {
            this._timerQueue.addTimer(this._timers.pomodoro);

            if (i == this._opt_pomodoriNumber) {
                this._timerQueue.addTimer(this._timers.longBreak);
            } else {
                this._timerQueue.addTimer(this._timers.shortBreak);
            }
        }
    },

    _connectTimerSignals: function() {
        let timerQueue = this._timerQueue;
        let pomodoroTimer = this._timers.pomodoro;
        let shortBreakTimer = this._timers.shortBreak;
        let longBreakTimer = this._timers.longBreak;

        timerQueue.connect('timer-queue-started', Lang.bind(this, function() {
            this._appletMenu.showPomodoroInProgress();
        }));

        timerQueue.connect('timer-queue-finished', Lang.bind(this, function() {
            this._numPomodoroFinished++;
            this._appletMenu.updatePomodoroCount(this._numPomodoroFinished);

            if (this._opt_autoStartNewAfterFinish) {
                if (this._longBreakdialog.state == ModalDialog.State.OPENED) {
                    this._longBreakdialog.close();
                }

                this._startNewTimer();
            } else {
                this._longBreakdialog.open();
            }
        }));

        timerQueue.connect('timer-queue-reset', Lang.bind(this, function() {
            this._setTimerLabel(0);
        }));

        pomodoroTimer.connect('timer-tick', Lang.bind(this, function(timer) {
            this._timerTickUpdate(timer);

            if (this._opt_playWarnSound && timer.getTicksRemaining() == this._opt_warnSoundDelay) {
                this._sounds.warn.play();
            }
        }));

        shortBreakTimer.connect('timer-tick', Lang.bind(this, this._timerTickUpdate));

        longBreakTimer.connect('timer-tick', Lang.bind(this, this._timerTickUpdate));
        longBreakTimer.connect('timer-tick', Lang.bind(this._longBreakdialog, this._longBreakdialog.setTimeRemaining));

        pomodoroTimer.connect('timer-running', Lang.bind(this, function() {
            this._playTickerSound();
        }));

        pomodoroTimer.connect('timer-stopped', Lang.bind(this, function() {
            this._stopTickerSound();
        }));

        shortBreakTimer.connect('timer-started', Lang.bind(this, function() {
            this._playBreakSound();
            Main.notify(_('Take a short break'));
        }));

        longBreakTimer.connect('timer-started', Lang.bind(this, function() {
            if (this._opt_showDialogMessages) {
                this._longBreakdialog.open();
            }
        }));
    },

    _startNewTimer: function() {
        if (this.__soundEffectSettingsChanged) {
            this._loadSoundEffects();
            delete this.__soundEffectSettingsChanged;
        }

        if (!this.__pomodoriNumberChangedWhileRunning) {
            this._timerQueue.reset();
        } else {
            this._resetPomodoroTimerQueue();
            delete this.__pomodoriNumberChangedWhileRunning;
        }

        this._longBreakdialog.setDefaultLabels();

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

    _playTickerSound: function() {
        if (this._opt_playTickerSound) {
            this._sounds.tick.play({ loop: true });
        }
    },

    _stopTickerSound: function() {
        this._sounds.tick.stop();
    },

    _playBreakSound: function() {
        if (this._opt_playBreakSound) {
            this._sounds.break.play();
        }
    },

    _loadSoundEffects: function() {
        this._sounds = this._sounds || {};

        try {
            this._sounds.tick = new SoundModule.SoundEffect(SoundModule.addPathIfRelative(this._opt_tickerSoundPath, this._defaultSoundPath));
            this._sounds.break = new SoundModule.SoundEffect(SoundModule.addPathIfRelative(this._opt_breakSoundPath, this._defaultSoundPath));
            this._sounds.warn = new SoundModule.SoundEffect(SoundModule.addPathIfRelative(this._opt_warnSoundPath, this._defaultSoundPath));
        } catch (e) {
            global.logError(e);
        }
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
            this._timerQueue.start();
        }));

        menu.connect('stop-timer', Lang.bind(this, function() {
            this._timerQueue.stop();
        }));

        menu.connect('reset-timer', Lang.bind(this, function() {
            this._timerQueue.reset();
            this._setTimerLabel(0);
        }));

        menu.connect('reset-counts', Lang.bind(this, function() {
            this._numPomodoroFinished = 0;
            this._appletMenu.updatePomodoroCount(0);
        }));

        menu.connect('show-settings', Lang.bind(this, function() {
            let command = "cinnamon-settings applets %s".format(this._metadata.uuid);
            Util.trySpawnCommandLine(command);
        }));

        menu.connect('what-is-this', Lang.bind(this, function() {
            let command = "gnome-open '%s'".format("http://en.wikipedia.org/wiki/Pomodoro_Technique");
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
    _createLongBreakDialog: function() {
        let dialog = new PomodoroFinishedDialog();

        dialog.connect('switch-off-pomodoro', Lang.bind(this, function() {
            this._longBreakdialog.close();
            this._timerQueue.stop();
            this._appletMenu.toggleTimerState(false);
        }));

        dialog.connect('start-new-pomodoro', Lang.bind(this, function() {
            // skipping the timer will make the timer-queue-finished event fire
            this._timerQueue.skip();

            // if auto start is enabled, the timer will be restarted automatically after the skip
            // so we only need to start new one if it's disabled and the user specifically requested it
            if (!this._opt_autoStartNewAfterFinish) {
                this._longBreakdialog.close();
                this._startNewTimer();
            }
        }));

        dialog.connect('hide', Lang.bind(this, function() {
            if (!this._timerQueue.isRunning() && !this._opt_autoStartNewAfterFinish) {
                // we are not auto starting a new timer and the timer is finished
                // so we'll reset it and turn it off
                this._timerQueue.reset();
                this._appletMenu.toggleTimerState(false);
            }

            this._longBreakdialog.close();
        }));

        return dialog;
    },

    // Setting listeners

    _onAppletIconChanged: function() {
        if (this._opt_displayIconInPanel) {
            this.set_applet_icon_path(this._metadata.path + "/icon.png");
        }
        else if (this._applet_icon_box.child) {
            this._applet_icon_box.child.destroy();
        }
    },

    _onPlayTickedSoundChanged: function() {
        if (!this._timers.pomodoro.isRunning()) {
            return;
        }

        if (this._opt_playTickerSound) {
            this._playTickerSound();
        }
        else {
            this._stopTickerSound();
        }
    },

    // Applet listeners

    on_applet_clicked: function() {
        this._appletMenu.toggle();
    },

    on_applet_removed_from_panel: function() {
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

        this._pomodoroCount = 0;

        this._addMenuItems();
        this.updatePomodoroCount(0);
    },

    _addMenuItems: function() {

        // "Pomodoro Timer"

        let onoff = new PopupMenu.PopupSwitchMenuItem(_("Pomodoro Timer"), false);
        this._timerToggle = onoff;

        onoff.connect("toggled", Lang.bind(this, function(menuItem, state) {
            state ? this.emit('start-timer') : this.emit('stop-timer');
        }));

        this.addMenuItem(onoff);

        // "Completed"

        let completed = new PopupMenu.PopupMenuItem(_("Completed"), { reactive: false });

        let bin = new St.Bin({ x_align: St.Align.END });

        this._pomodoriCountLabel = new St.Label();
        bin.add_actor(this._pomodoriCountLabel);

        completed.addActor(bin, { expand: true, span: -1, align: St.Align.END });

        this.addMenuItem(completed);

        // "Reset Timer"

        let reset = new PopupMenu.PopupMenuItem(_('Reset Timer'));

        reset.connect('activate', Lang.bind(this, function() {
            this.toggleTimerState(false);

            this.emit('reset-timer');
        }));

        this.addMenuItem(reset);

        // "Reset Counts and Timer"

        let resetAll = new PopupMenu.PopupMenuItem(_('Reset Counts and Timer'));

        resetAll.connect('activate', Lang.bind(this, function() {
            this.toggleTimerState(false);

            this.emit('reset-timer');
            this.emit('reset-counts');
        }));

        this.addMenuItem(resetAll);

        // "Settings"

        let settings = new PopupMenu.PopupMenuItem(_("Settings"));

        settings.connect("activate", Lang.bind(this, function() {
            this.emit('show-settings');
        }));

        this.addMenuItem(settings);

        // "What is this?"

        let whatisthis = new PopupMenu.PopupMenuItem(_("What is this?"));

        whatisthis.connect("activate", Lang.bind(this, function() {
            this.emit('what-is-this');
        }));

        this.addMenuItem(whatisthis);
    },

    toggleTimerState: function(state) {
        this._timerToggle.setToggleState(Boolean(state));
    },

    showPomodoroInProgress: function() {
        let text = '';

        if (this._pomodoroCount > 0) {
            text = this._pomodoriCountLabel.text;
        }

        text += '\u25d6';

        this._pomodoriCountLabel.text = text;
    },

    updatePomodoroCount: function(count) {
        let text;

        this._pomodoroCount = count;

        if (count == 0) {
            text = _('None');
        } else {
            text = Array(count + 1).join('\u25cf');
        }

        this._pomodoriCountLabel.text = text;
    }
};

function PomodoroFinishedDialog() {
    this._init.call(this);
}

PomodoroFinishedDialog.prototype = {
    __proto__: ModalDialog.ModalDialog.prototype,

    _init: function() {
        ModalDialog.ModalDialog.prototype._init.call(this);

        this._subjectLabel = new St.Label();

        this.contentLayout.add(this._subjectLabel);

        this._timeLabel = new St.Label();

        this.contentLayout.add(this._timeLabel);

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

        this.setDefaultLabels();
    },

    setDefaultLabels: function() {
        this._subjectLabel.set_text(_("Pomodoro finished, you deserve a break!") + "\n");
        this._timeLabel.text = '';
    },

    setTimeRemaining: function(timer) {
        let tickCount = timer.getTicksRemaining();

        if (tickCount == 0) {
            this._subjectLabel.text = _("Your break is over, start another pomodoro!") + "\n";
            this._timeLabel.text = '';
            return;
        }

        this._setTimeLabelText(_("A new pomodoro begins in ") + this._getTimeString(tickCount)) + "\n"
    },

    _setTimeLabelText: function(label) {
        this._timeLabel.set_text(label + "\n");
    },

    _getTimeString: function(totalSeconds) {
        let minutes = parseInt(totalSeconds / 60);
        let seconds = parseInt(totalSeconds % 60);

        return "%d minutes and %d seconds".format(minutes, seconds);
    }
};
