#!/bin/bash

# This script synchronizes the latest version of the Pomodoro applet from the development directory
# to the local Cinnamon applets directory. It's useful for testing changes immediately in a local environment.
# It uses rsync to ensure only changed files are updated, excluding any hidden files. This script is ideally
# combined with a file watcher script that triggers this script upon file changes for continuous deployment.

rsync -avtc --checksum --exclude=".*" pomodoro@gregfreeman.org ~/.local/share/cinnamon/applets/
