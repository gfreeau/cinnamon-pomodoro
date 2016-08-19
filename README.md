#### This repo is a fork from [cinnamon-pomodoro](https://github.com/gfreeau/cinnamon-pomodoro "Cinnamon Pomodoro")
### Addet Functions to this Pomodoro Timer
- Translate this Applet in German
- Addet GitHub and BitBucked issues
- Addet popular Task- and ToDo-Lists
    - Taskwarrior
    - ToDoist
    - Asana
    - Trello
    - Wunderlist
    - Remember The Milk
    - ...

---
# Pomodoro Timer for Cinnamon 2.x, 1.8.x

# English

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

## Installing an existing translation

* To install an existing translation file, you need to move or copy the .mo file located in the "cinnamon-pomodoro/pomodoro@gregfreeman.org/po" folder to your local locales folder "~/.local/share/locale/LOCALE_ID/LC_MESSAGES"
* The file name must be the same as the applet UUID with the .mo extension : pomodoro@gregfreeman.org.mo

### Example for the french translation file


``` shell
$ mv ~/.local/share/cinnamon/applets/pomodoro@gregfreeman.org/po/pomodoro@gregfreeman.org_fr.mo ~/.local/share/locale/fr/LC_MESSAGES/pomodoro@gregfreeman.org.mo
```

It is possible that the "locale" folder doesn't exists in "~/.local/share", in this case create the required folder tree ("locale/YOUR_LOCALE_ID/LC_MESSAGES") before using the command above

* You may need to restart cinnamon, press ALT-F2 and enter 'r'
* Enjoy the french translation :)

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
* Please add your translations to the [original owner repository](https://github.com/gfreeau/cinnamon-pomodoro).
* Use cinnamon-json-makepot to test your translations

--------------------------------------------------------------------------------------------------------------------------------

# Français

La technique pomodoro est utilisée pour booster la productivité et cet applet vous permet de l'utiliser d'une façon simple et intuitive, directement sur votre bureau cinnamon.
Pour en savoir plus sur la technique Pomodoro, je vous invite à consulter la [page Wikipedia](https://fr.wikipedia.org/wiki/Technique_Pomodoro)

## Page de l'applet

http://cinnamon-spices.linuxmint.com/applets/view/131

## Installation

Afin d'installer l'applet, il vous faut suivre les étapes suivantes:

* Vous devez installer "SoX play" afin de pouvoir lire les fichiers sons, celui-ci est préinstallé sur Linux Mint et Ubuntu, vous pouvez facilement le verifier
<pre>
$ which play
$ man play
</pre>
Si vous ne l'avez pas, vous allez devoir l'installer pour votre distribution, pour debian il vous suffit de taper la commande suivante dans votre terminal: 
<pre>
$ sudo apt-get install sox
</pre>
* Clonez le repository et installez les fichiers dans le repertoire des applets de cinnamon 
<pre>
    $ git clone git@github.com:gfreeau/cinnamon-pomodoro.git
    $ cp -r cinnamon-pomodoro/pomodoro@gregfreeman.org ~/.local/share/cinnamon/applets
</pre>
* Sinon, si vous n'avez pas GIT installé, vous pouvez simplement telecharger le fichier zip
<pre>
    $ wget https://github.com/gfreeau/cinnamon-pomodoro/archive/master.zip -O cinnamon-pomodoro.zip
    $ unzip cinnamon-pomodoro.zip
    cp -r cinnamon-pomodoro/pomodoro@gregfreeman.org ~/.local/share/cinnamon/applets
</pre>
* Vous pourriez avoir a redemarrer cinnamon, pour cela appuyez sur "ALT + F2", tapez "r" et validez
* Pour finir, activez cet applet en vous rendant sur Menu->Parametres->Applets et en selectionnant Pomodoro
* Soyez productif!
* Get productive!

## Installer une traduction existante

* Pour installer un fichier de traduction existant, vous avez besoin de déplacer ou copier le fichier .mo situé dans le repertoire "cinnamon-pomodoro/pomodoro@gregfreeman.org/po" vers votre repertoire local de localizations "~/.local/share/locale/LOCALE_ID/LC_MESSAGES"
* Ce fichier doit être nommé avec l'UUID de l'application et porter l'extension .mo : pomodoro@gregfreeman.org.mo

### Exemple avec le fichier de traduction pour la langue française

``` shell
$ mv ~/.local/share/cinnamon/applets/pomodoro@gregfreeman.org/po/pomodoro@gregfreeman.org_fr.mo ~/.local/share/locale/fr/LC_MESSAGES/pomodoro@gregfreeman.org.mo
```

Il est possible que le repertoire "locale" n'existe pas dans "~/.locale/share", dans ce cas, créez la structure de repertoires requise ("locale/VOTRE_LOCALE_ID/LC_MESSAGES") avant d'utiliser la commande ci-dessus

* Vous pourriez avoir a redemarrer cinnamon, pour cela appuyez sur "ALT + F2", tapez "r" et validez
* Profitez de la traduction française! :)

## Créer une traduction

```shell
$ cd po
$ msginit
```

Vous pouvez aussi spécifier la localization et le fichier .pot

```shell
$ msginit --locale=fr --input=pomodoro@gregfreeman.org.pot
```

* Editez le nouveau fichier .po crée et changez "msgstr" avec votre chaine de texte traduite
* S'il vous plait, ajoutez vos traduction sur le [repository du créateur de l'applet](https://github.com/gfreeau/cinnamon-pomodoro).
* Vous pouvez utiliser cinnamon-json-makepot pour tester vos traduction
* Vous pouvez également utiliser msgfmt pour créer un fichier .mo à partir d'un fichier .po
