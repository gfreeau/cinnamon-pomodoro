# Pomodoro Timer for Cinnamon 2.x, 1.8.x

The pomodoro technique is used to boost productivity and this applet provides an easy way to use the technique right on your desktop.
Read more about the technique here: http://en.wikipedia.org/wiki/Pomodoro_Technique

## Applet page

http://cinnamon-spices.linuxmint.com/applets/view/131

## Installation

In order to install cinnamon-pomodoro you have to execute the following steps:
* You need SoX play to play sound files, it is pre-installed on Linux Mint / Ubuntu, you can easily check:
<pre>
$ which play
$ man play
</pre>
If you do not have it, you will need to install it for your distribution, for debian it is:
<pre>
$ sudo apt-get install sox
</pre>
* Clone the repository and install the files into the cinnamon applet directory;
<pre>
    $ git clone git@github.com:gfreeau/cinnamon-pomodoro.git
    $ cp -r cinnamon-pomodoro/pomodoro@gregfreeman.org ~/.local/share/cinnamon/applets
</pre>
* Alternatively, if you don't have GIT installed you can just download zip file
<pre>
    $ wget https://github.com/gfreeau/cinnamon-pomodoro/archive/master.zip -O cinnamon-pomodoro.zip
    $ unzip cinnamon-pomodoro.zip
    cp -r cinnamon-pomodoro/pomodoro@gregfreeman.org ~/.local/share/cinnamon/applets
</pre>
* You may need to restart cinnamon, press ALT-F2 and enter 'r'
* Finally, enable the applet by going to Menu->Settings->Applets and selecting Pomodoro
* Get productive!

## Make a translation

```shell
$ cd po
$ msginit
```

You can also specify the locale and pot file

```shell
$ msginit --locale=fr --input=pomodoro@gregfreeman.org.pot
```

* Edit the newly created .po file and change msgstr to translated text.
* Please add your translations to this repository.
* Use cinnamon-json-makepot to test your translations
