const Util = imports.misc.util;
const GLib = imports.gi.GLib;
const Params = imports.misc.params;

/**
 *
 * The functions in /usr/share/cinnamon/js/misc/util.js
 * don't return the pid, we need the pid so we can stop sounds
 *
 * @param {string} command
 * @returns {number} process id
 */
function spawnCommandAndGetPid(command) {
    let flags = GLib.SpawnFlags.SEARCH_PATH | GLib.SpawnFlags.STDOUT_TO_DEV_NULL  | GLib.SpawnFlags.STDERR_TO_DEV_NULL;
    let argv = GLib.shell_parse_argv(command)[1];
    let pid = GLib.spawn_async(null, argv, null, flags, null, null)[1];

    return pid;
}

function addPathIfRelative(soundPath, basePath) {
    // user set a custom absolute path, so lets use that
    if (soundPath.substring(0, 1) == '/') {
        return soundPath;
    }

    let fullPath = '';

    if (basePath) {
        fullPath += basePath + '/';
    }

    fullPath += soundPath;

    return fullPath;
}

function SoundEffect(soundPath) {
    this._init(soundPath);
}

SoundEffect.prototype = {
    _init: function(soundPath) {
        let isPlayable = GLib.find_program_in_path('play') != null;

        if (!GLib.file_test(soundPath, GLib.FileTest.EXISTS)) {
            isPlayable = false;
        }

        if (!isPlayable) {
            throw new Error("Unable to play sound, make sure 'play' is available on your path" +
                " and that '%s' is a valid sound file".format(soundPath));
        }

        this._isPlayable = isPlayable;
        this._soundPath = soundPath;
        this._pid = null;
    },

    play: function(params) {
        if (!this._isPlayable) {
            return false;
        }

        if (null != this._pid) {
            this.stop();
        }

        params = Params.parse(params, { loop: false });

        let command = "play -q '%s'".format(this._soundPath);

        if (params.loop) {
            command += " repeat 9999";
        }

        this._pid = spawnCommandAndGetPid(command);

        return true;
    },

    playOnce: function() {
        return this.play();
    },

    stop: function() {
        if (null == this._pid) {
            return;
        }

        let command = 'kill -9 %d'.format(this._pid);
        Util.trySpawnCommandLine(command);

        this._pid = null;
    },

    isPlaying: function() {
        return this._pid != null;
    },

    getSoundPath: function() {
        return this._soundPath;
    }
};