# ChangeLog

* **0.6.0** (2019-04-10)
  - Fix "fish-pepper.ignore-for" handling to ignore certain parameter combinations.
    See fabric8io-images/java how this is used

* **0.5.9** (2017-09-10)
  - Allow tags to be used for Git blocks
  
* **0.5.2**
  - Allow deeper storage of image families
  - Add `ignore-for` config options to avoid creating certain images
  - Fix 'git pull' which had a race condition
  - Fix serialization of build process (#1)
