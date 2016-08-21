#!/bin/bash

# works well when combined with a script that watches for changes
# i.e https://gist.github.com/senko/1154509
# onchange ./testdeploy.sh

rsync -avt --exclude=".*" pomodoro@gregfreeman.org ~/.local/share/cinnamon/applets/
