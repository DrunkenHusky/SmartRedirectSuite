# [2.12.0](https://github.com/DrunkenHusky/SmartRedirectSuite/compare/v2.11.0...v2.12.0) (2025-12-07)


### Bug Fixes

* make 'Type' column mandatory for rule imports ([d53365d](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/d53365d265d7c9df920b980cbb332550393140a1))
* **ui:** make footer sticky/fixed to bottom of migration page ([dd39bb2](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/dd39bb2764a0ec75362b5fb106e116730ce9bc6f))


### Features

* Add "Delete All Statistics" to Admin Danger Zone ([43df9b9](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/43df9b9c7dd1f177e9f5b636a565c4515ce58d7a))
* Add filter for entries without rules in statistics ([ff61ae6](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/ff61ae635d492f49387ea0e726e5a9df950e6680))
* **admin:** add 'only without rules' filter to statistics ([1f8a48a](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/1f8a48a5785bc378df451b17db3bb298fa1ad1e1))

# [2.11.0](https://github.com/DrunkenHusky/SmartRedirectSuite/compare/v2.10.0...v2.11.0) (2025-12-06)


### Bug Fixes

* **admin:** optimize standard export buttons for mobile view ([a60bac0](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/a60bac04094c436b0c65f9be4d085ad5d30959a3))
* **admin:** pretty print JSON exports for rules and settings ([cd5333e](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/cd5333e4c2356c54996e9a9a6615c22e3cb25e17))
* **admin:** prevent side scrolling in import popup ([21c34ab](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/21c34ab71387f216cf16d0a5f2acc6e19633a9c9))
* **admin:** remove side scroll from Rules and Import Preview tables ([7f9a1df](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/7f9a1dfcb89ccdbc9c03c33061ff8eb6723de1aa))
* ensure upload directory exists for import feature ([0e224e7](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/0e224e733e7011f5ee1814f1cc52ef1cd53bb3e6))
* **frontend:** send full url to check-rules endpoint ([b5544c6](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/b5544c6d1773c0d773f16b8f972c34e67d358651))
* import and update logic for query params options ([039533c](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/039533c4fa551fc4796d9fbd00e7d5e804b3892e))
* **validation:** add query params flags to validation schema ([3801992](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/38019923fc55c54e78d17e4dfd31fbfbe3913944))


### Features

* add options for granular query param handling in rules ([f28b53d](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/f28b53d56022c67e6d9cce4596928c7ca6449c32))
* add options for granular query param handling in rules ([c8a9e0b](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/c8a9e0b4920ead9bf42ada3029aeaeff1d9c3166))
* add Query Parameter column to Admin Rules table ([eb53366](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/eb53366dde8c4351a47d4b6b305fb546aa7f516c))
* add Query Params column to Import Preview ([d15af14](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/d15af1479357441dd4daeb97ab4b987234b422a5))
* add validation for query params settings in import ([512c8c3](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/512c8c33084211b4d3825b0db2c353b29da44183))
* **admin:** optimize rules list rendering with memoization and conditional rendering ([c37c6d4](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/c37c6d4a54cfd1b85983c0e785192eb8f66661ce))
* ensure only relevant redirect flags are stored ([f5a40ca](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/f5a40caf4be31869d7fe1d51675c7b64f57418bb))
* rename "Parameter" column to "Query Parameter" in import preview ([10ba84b](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/10ba84b3656dd9a6d632669d8c198c233fbf344a))
* rename Maintenance to Danger-Zone and add Delete All Rules feature ([558f993](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/558f993856b22e57a8d43cacf36af4ddc1ea9e00))
* update import preview column titles ([022da5f](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/022da5f953adef55ba8fa7fb8260a001d8405531))
* update import preview table labels and badges ([e21eb84](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/e21eb84a075f8e569a617bb784481b96a5bf371a))


### Performance Improvements

* optimize sorting in admin endpoints and remove redundant invalidations ([fb88a8e](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/fb88a8eaad28b41f0d136a1100695774d55eae66))

# [2.10.0](https://github.com/DrunkenHusky/SmartRedirectSuite/compare/v2.9.0...v2.10.0) (2025-12-05)


### Bug Fixes

* **admin:** add missing async keyword to handleExecuteImport ([3b481e8](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/3b481e847249cff5326ea06ecb98fcb1382a5eaf))
* **admin:** optimize import preview endpoint payload size ([171f7e9](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/171f7e9504583f7442811188cd8bc6fc9136ca30))
* allow xlsx format in export request schema ([abcb18d](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/abcb18dd2f24fd83b2456af16c6913096da6b049))
* **deps:** sync package-lock.json and replace xlsx with @e965/xlsx ([aa68ee9](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/aa68ee9eeb6876cee5a870929859f4f04c1576e0))
* ensure excel export uses .xlsx extension in admin panel ([82250d2](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/82250d261414d36d6d1fad7ded5e642d0472608c))
* **export:** strip internal cache properties from exported rules ([015d634](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/015d634daee3f4b9e851dad584337acbf5581f11))
* **frontend:** prevent crash when import preview response lacks 'all' data ([5a3adc9](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/5a3adc9c6f314f3c9326f713c941721dac823e53))
* **import:** correct status detection for existing matchers and enhance preview UI ([dd7a759](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/dd7a7597a1c83e62fa0e7ce385d432ea4c3a0b79))
* **import:** handle undefined ID and fix Zod compatibility ([159cfeb](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/159cfebce2d4f3217fe34764038727d4797f8c6a))
* **rule-matching:** fix domain replacement rule matching logic ([2a548de](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/2a548de8abd5551e84ff4310998ca1a0ce9d371e))
* **rule-matching:** handle root-relative paths in matcher ([6a36c2b](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/6a36c2b4303cbcbcb4021ea13117a1d36ad301ab))
* **rules:** allow overlapping URL matchers ([78b85b0](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/78b85b0db8166239cd0acf97424d6ba4873e9c0d))
* **rules:** support domain matching in check-rules endpoint ([0be4b3a](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/0be4b3a5d3edb2ab31dd44920a81ea0bab1fc001))
* **server:** prevent crash in export error handling ([8dd3fe9](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/8dd3fe90273c2a8e6e250c63e9010dfe8752d1fb))
* **ui:** prevent horizontal scroll in admin rules table ([e949756](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/e949756c209858da66f6d9ba5ef61ffd031ec0c8))
* **ui:** remove duplicate unstyled 'URLs automatisch kodieren' toggle ([072e73b](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/072e73b8a7d4b72b706e718ae7b108682f3d4bb9))
* **validation:** add support for domain redirect type ([9b01dfc](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/9b01dfcd593de9714ecf41c72a7433202c4958cb))


### Features

* add domain replacement option for partial redirects ([f09cd1a](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/f09cd1ad5a5a05e371c0382bfe02f5246a4c0e9b))
* **admin:** refactor import/export tab structure and button naming ([ad5ba6e](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/ad5ba6e27d2197b1a49f14efc09004ddd7a856a8))
* **admin:** set encodeImportedUrls to default true and silence toast on toggle ([5e84ae4](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/5e84ae4a3a391474191990e10ad66e660498267b))
* enforce strict domain validation for domain redirects ([a247cb4](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/a247cb462288b4412427e97261275399ae41e190))
* enhance domain rule matcher logic and documentation ([cf3b34a](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/cf3b34a1dce6e4dc0396b2dc189036ff0871e4f7))
* enhance import preview with status tooltip ([89c331f](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/89c331f59d723106f2848e54eae9dfd57e976f91))
* make URL encoding during import configurable ([3d36743](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/3d367435137a86c238c1f9807eb687786b8f0ec9))
* Optimize Importer/Exporter and Fix Crashes ([22addc4](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/22addc490cea267ef7d738864fdad56f07039b20))
* optimize importer/exporter, fix export bugs, and improve UI ([48f5806](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/48f5806ed06b911f6608913f38fa765e7a331053))
* suppress toast for encode url toggle ([1343f38](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/1343f384d66c5f75bcd1d289829f030df0d8993c))
* track and display all matching rules in statistics ([088ce30](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/088ce307918088e88612d8a6216ad54a839f24fc))

# [2.9.0](https://github.com/DrunkenHusky/SmartRedirectSuite/compare/v2.8.0...v2.9.0) (2025-12-04)


### Features

* support implicit partial segment matching ([b14fe96](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/b14fe965b984344d8114b16972fa063e20c50646))

# [2.8.0](https://github.com/DrunkenHusky/SmartRedirectSuite/compare/v2.7.3...v2.8.0) (2025-12-04)


### Bug Fixes

* enable excel/csv upload and ui preview dialog ([81a4913](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/81a49133425665208be967df44533317928b0383))
* remove duplicate importMutation declaration in admin.tsx ([e74713d](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/e74713d208417b035b35b258f990972c29e25926))


### Features

* add excel/csv import and export for rules ([6ef480e](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/6ef480e45df8718d868a69b3b6551919703a016f))
* Add Excel/CSV Import/Export with Preview and UI enhancements ([1abafb6](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/1abafb6822cd83b8b25f74bb1f269d726ada9533))
* Add Excel/CSV Import/Export with Preview, UI enhancements, and sample files ([0e1c8ab](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/0e1c8ab7878e56d4f8228b193ee30f2dde598775))
* enhance import/export with excel/csv support and preview ([cf51629](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/cf516297af803da406e5f035a9d958a0b8f002ba))
* enhance import/export with excel/csv support and preview ([7adf619](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/7adf61985d537591932f2e88d4ea189719689861))

## [2.7.3](https://github.com/DrunkenHusky/SmartRedirectSuite/compare/v2.7.2...v2.7.3) (2025-12-01)


### Bug Fixes

* **api:** handle invalid ruleId in tracking and sanitize input ([5cad5a1](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/5cad5a15ffc4ff6689e62e84a2ef67be932409f5))

## [2.7.2](https://github.com/DrunkenHusky/SmartRedirectSuite/compare/v2.7.1...v2.7.2) (2025-12-01)


### Bug Fixes

* **server:** prevent console.error crash on error inspection ([b2de90e](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/b2de90ea018c591573dbb4dee9a01217af889f5d))

## [2.7.1](https://github.com/DrunkenHusky/SmartRedirectSuite/compare/v2.7.0...v2.7.1) (2025-12-01)


### Bug Fixes

* **api:** relax tracking schema validation and improve error messages ([f8aae71](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/f8aae715d0cf757a74da8cb2c075578c8e18230c))

# [2.7.0](https://github.com/DrunkenHusky/SmartRedirectSuite/compare/v2.6.0...v2.7.0) (2025-12-01)


### Bug Fixes

* **data:** remove obsolete showMatchIndicator from settings ([d1e825b](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/d1e825b2d82dd25232772a1c47aaa2dd1b336814))


### Features

* make matching indicator texts configurable ([1af8509](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/1af8509ff746008cb6a50da7d92ccf3b4df4b7a6))

# [2.6.0](https://github.com/DrunkenHusky/SmartRedirectSuite/compare/v2.5.0...v2.6.0) (2025-12-01)


### Bug Fixes

* adjust quality score logic and ensure case sensitivity ([eff041f](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/eff041f220af72ee95f534d4ca5c30c857284065))
* fix rule dialog access from statistics tab and table formatting ([31b5d62](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/31b5d62fac1567323affa0e4292008b86b216328))
* **ui:** remove duplicate link quality indicator from migration page ([e9481bd](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/e9481bdcb41a9acf21a2dd79a317ae7af9327caf))


### Features

* Restore admin redirect settings and fix build ([3599508](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/35995080cc3846526ec4b4e24dad2412b7b79f2a))

# [2.5.0](https://github.com/DrunkenHusky/SmartRedirectSuite/compare/v2.4.0...v2.5.0) (2025-12-01)


### Features

* enhance API security and increase import limit ([befda0a](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/befda0ae8fc0cc1edc5517e6db908a82919d00c7))

# [2.4.0](https://github.com/DrunkenHusky/SmartRedirectSuite/compare/v2.3.2...v2.4.0) (2025-12-01)


### Features

* add match quality gauge and move settings ([6b42eb3](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/6b42eb3694de5803e6f3c6686c1a6e26d3ac33f9))
* add match quality gauge and refactor settings ([167c33f](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/167c33f58d1c59a042497e10ff05d2f956167ffc))
* harden application security against OWASP Top 10 risks ([ed05ee5](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/ed05ee59ba51f4abf9e4aae0d3a1f454687b2c43))
* show clickable rule link in tracking statistics ([13a4e08](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/13a4e084e5919b597083f46a553204531c081bde))
* show clickable rule link in tracking statistics ([e34632f](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/e34632fb521f0aaef184a8f66bb6a71f34a9a0c5))

## [2.3.2](https://github.com/DrunkenHusky/SmartRedirectSuite/compare/v2.3.1...v2.3.2) (2025-11-27)


### Bug Fixes

* **ui:** add missing DialogDescription to DialogContent components ([2738487](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/2738487b1828462028b272c3a1d635c7b1d843d9))

## [2.3.1](https://github.com/DrunkenHusky/SmartRedirectSuite/compare/v2.3.0...v2.3.1) (2025-11-27)


### Bug Fixes

* **client:** move mutation hook to top level in AdminPage ([ec916b3](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/ec916b3809c0f67c2f374b508c56711a3a0223bf))
* **client:** move mutation hook to top level in AdminPage ([db2ec0d](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/db2ec0dbf9af9d9abb9f0d05d5b168980651481e))

# [2.3.0](https://github.com/DrunkenHusky/SmartRedirectSuite/compare/v2.2.0...v2.3.0) (2025-11-27)


### Features

* Add functionality to force cache rebuild via Admin UI ([de3239b](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/de3239b1e727d44dd40f05c430f7b0f8f751fcd8))

# [2.2.0](https://github.com/DrunkenHusky/SmartRedirectSuite/compare/v2.1.1...v2.2.0) (2025-11-27)


### Features

* **ui:** update page title from admin settings ([3ec4ec0](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/3ec4ec0b66c258cdf8d7ee09d6244a515abe28a8))

## [2.1.1](https://github.com/DrunkenHusky/SmartRedirectSuite/compare/v2.1.0...v2.1.1) (2025-11-27)


### Performance Improvements

* optimize rule matching with unified pre-processed cache ([3f02fa8](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/3f02fa8a49f8cb5ed18439830fa8631359f0ff3a))
* optimize rule matching with unified pre-processed cache ([aa3f97c](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/aa3f97c91f5ea00742394696b8861e27f732d887))

# [2.1.0](https://github.com/DrunkenHusky/SmartRedirectSuite/compare/v2.0.1...v2.1.0) (2025-11-27)


### Features

* implement dynamic favicon update based on logo or icon settings ([e3bbfad](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/e3bbfad4c864ca3adb91741ad51c90f21f56149e))

## [2.0.1](https://github.com/DrunkenHusky/SmartRedirectSuite/compare/v2.0.0...v2.0.1) (2025-11-27)


### Bug Fixes

* correct app name to smartredirectsuite and sync lockfile ([fc8383e](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/fc8383e570c5dab4a83ecccce7e9cc6bd07eb348))

# [2.0.0](https://github.com/DrunkenHusky/SmartRedirectSuite/compare/v1.0.0...v2.0.0) (2025-11-25)


### Features

* Zentralisierung und Überarbeitung der Dokumentation ([06860b3](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/06860b3776ff91a872383487383b030e7265601d))


### BREAKING CHANGES

* Die Dateipfade zu allen Dokumentationsdateien (außer README.md) haben sich geändert. Alle direkten Links, die auf die alten Pfade verweisen, sind nicht mehr gültig. Diese Umstrukturierung ist notwendig, um die Kompatibilität mit neuen Automatisierungsprozessen für die Release-Erstellung und Dokumentationsverwaltung zu gewährleisten und eine saubere Grundlage für zukünftige Erweiterungen zu schaffen.
