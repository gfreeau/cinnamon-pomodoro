# Pomodoro Timer for Cinnamon Desktop

# English

The Pomodoro technique is used to boost productivity and this applet provides an easy way to use the technique right on your desktop.
Read more about the technique here: http://en.wikipedia.org/wiki/Pomodoro_Technique.

## Applet page

http://cinnamon-spices.linuxmint.com/applets/view/131

## Installation

In order to install cinnamon-pomodoro you have to execute the following steps:
* You need SoX play to play sound files, it is pre-installed on Linux Mint / Ubuntu, you can easily check:
<pre>
$ which play
$ man play
</pre>
If you do not have it, you will need to install it for your distribution, for Debian it is:
<pre>
$ sudo apt-get install sox
</pre>
* Clone the repository and install the files into the Cinnamon applet directory:
<pre>
    $ git clone git@github.com:gfreeau/cinnamon-pomodoro.git
</pre>
* Then call `update-applet.sh` to overwrite the applet downloaded with the latest local changes
<pre>
    $ ./update-applet.sh
</pre>
* Alternatively, if you don't have GIT installed you can just download zip file:
<pre>
    $ wget https://github.com/gfreeau/cinnamon-pomodoro/archive/master.zip -O cinnamon-pomodoro.zip
    $ unzip cinnamon-pomodoro.zip
    $ cp -r cinnamon-pomodoro/pomodoro@gregfreeman.org ~/.local/share/cinnamon/applets
</pre>
* You will need to restart Cinnamon, press ALT-F2 and enter 'r'
* Finally, enable the applet by going to Menu->Settings->Applets and selecting Pomodoro
* Get productive!

## Installing an existing translation

* To install an existing translation file, you need to move or copy the .mo file located in the "cinnamon-pomodoro/pomodoro@gregfreeman.org/po" folder to your local locales folder "~/.local/share/locale/LOCALE_ID/LC_MESSAGES"
* The file name must be the same as the applet UUID with the .mo extension : pomodoro@gregfreeman.org.mo

### Example for the french translation file


``` shell
$ mv ~/.local/share/cinnamon/applets/pomodoro@gregfreeman.org/po/fr.mo ~/.local/share/locale/fr/LC_MESSAGES/pomodoro@gregfreeman.org.mo
```

It is possible that the "locale" folder doesn't exists in "~/.local/share", in this case create the required folder tree ("locale/YOUR_LOCALE_ID/LC_MESSAGES") before using the command above

* You may need to restart Cinnamon, press ALT-F2 and enter 'r'
* Enjoy the french translation :)

## Make a translation

```shell
$ cd po
$ msginit
```

You can also specify the locale and pot file:

```shell
$ msginit --locale=fr --input=pomodoro@gregfreeman.org.pot
```

* Edit the newly created .po file and change msgstr to translated text.
* Please add your translations to the [original owner repository](https://github.com/gfreeau/cinnamon-pomodoro).
* Use cinnamon-json-makepot to test your translations.
* You can also use msgfmt to create a .mo file from the .po file.

--------------------------------------------------------------------------------------------------------------------------------

# Français

La technique Pomodoro est utilisée pour booster la productivité et cette applet vous permet de l'utiliser d'une façon simple et intuitive, directement sur votre bureau Cinnamon.
Pour en savoir plus sur la technique Pomodoro, je vous invite à consulter la [page Wikipedia](https://fr.wikipedia.org/wiki/Technique_Pomodoro).

## Page de l'applet

http://cinnamon-spices.linuxmint.com/applets/view/131

## Installation

Afin d'installer l'applet, il vous faut suivre les étapes suivantes :

* Vous devez installer "SoX play" afin de pouvoir lire les fichiers sons, celui-ci est préinstallé sur Linux Mint et Ubuntu, vous pouvez facilement le vérifier :
<pre>
$ which play
$ man play
</pre>
Si vous ne l'avez pas, vous allez devoir l'installer pour votre distribution, pour Debian il vous suffit de taper la commande suivante dans votre terminal : 
<pre>
$ sudo apt-get install sox
</pre>
* Clonez le repository et installez les fichiers dans le répertoire des applets de Cinnamon :
<pre>
    $ git clone git@github.com:gfreeau/cinnamon-pomodoro.git
    $ cp -r cinnamon-pomodoro/pomodoro@gregfreeman.org ~/.local/share/cinnamon/applets
</pre>
* Sinon, si vous n'avez pas GIT installé, vous pouvez simplement télécharger le fichier zip :
<pre>
    $ wget https://github.com/gfreeau/cinnamon-pomodoro/archive/master.zip -O cinnamon-pomodoro.zip
    $ unzip cinnamon-pomodoro.zip
    $ cp -r cinnamon-pomodoro/pomodoro@gregfreeman.org ~/.local/share/cinnamon/applets
</pre>
* Vous pourriez avoir à redémarrer Cinnamon, pour cela appuyez sur "ALT + F2", tapez "r" et validez
* Pour finir, activez cette applet en vous rendant sur Menu->Préférences->Applets et en sélectionnant Pomodoro
* Soyez productif !

## Installer une traduction existante

* Pour installer un fichier de traduction existant, vous avez besoin de déplacer ou copier le fichier .mo situé dans le repertoire "cinnamon-pomodoro/pomodoro@gregfreeman.org/po" vers votre répertoire local de localisations "~/.local/share/locale/LOCALE_ID/LC_MESSAGES"
* Ce fichier doit être nommé avec l'UUID de l'application et porter l'extension .mo : pomodoro@gregfreeman.org.mo

### Exemple avec le fichier de traduction pour la langue française

``` shell
$ mv ~/.local/share/cinnamon/applets/pomodoro@gregfreeman.org/po/fr.mo ~/.local/share/locale/fr/LC_MESSAGES/pomodoro@gregfreeman.org.mo
```

Il est possible que le répertoire "locale" n'existe pas dans "~/.locale/share", dans ce cas, créez la structure de répertoire requise ("locale/VOTRE_LOCALE_ID/LC_MESSAGES") avant d'utiliser la commande ci-dessus.

* Vous pourriez avoir à redémarrer Cinnamon, pour cela appuyez sur "ALT + F2", tapez "r" et validez
* Profitez de la traduction française ! :)

## Créer une traduction

```shell
$ cd po
$ msginit
```

Vous pouvez aussi spécifier la localisation et le fichier .pot :

```shell
$ msginit --locale=fr --input=pomodoro@gregfreeman.org.pot
```

* Editez le nouveau fichier .po créé et changez "msgstr" avec votre chaîne de texte traduite.
* S'il vous plait, ajoutez vos traductions sur le [repository du créateur de l'applet](https://github.com/gfreeau/cinnamon-pomodoro).
* Vous pouvez utiliser cinnamon-json-makepot pour tester vos traductions.
* Vous pouvez également utiliser msgfmt pour créer un fichier .mo à partir d'un fichier .po.
