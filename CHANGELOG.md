# [2.17.0](https://github.com/DrunkenHusky/SmartRedirectSuite/compare/v2.16.0...v2.17.0) (2026-02-09)


### Bug Fixes

* add @tailwindcss/vite plugin to vite.config.ts ([453cbc7](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/453cbc7352dd1f7eb28474a7f73c5afbeda715d6))
* **deps:** move @tailwindcss/vite to dependencies ([c584965](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/c5849659efa12c27b5abacc76cb599b252db253d))
* ensure configuration validation tool files and integration are persisted ([2fea0ea](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/2fea0eab4d073d48a19ecf36b465e814cae3e7a0))
* exclude vite.config from server bundle ([ea01bdb](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/ea01bdb4fddf1a9cc8185eb95ffaa55fe55e8f30))
* improve validation tool UI and search fallback ([9bed0a0](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/9bed0a09a0fe98faf50bf2b286e0d7b07b68039c))
* make footer version link more visible ([0a8fff1](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/0a8fff1b586d0669fc503505aa6d67b7f4a45da0))
* prevent crash in validation tool and improve UI ([db2dc9e](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/db2dc9ef779894cd6bb38e5571a5ece5aad45177))
* resolve CI build errors ([0bd5fd4](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/0bd5fd49379faeb7e36e26d9263e6973dcb1d1ac))


### Features

* add configuration validation tool ([812e447](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/812e447b2a50420953b8ad00b4d23d83c9f39bc0))
* add configuration validation tool ([49d6e5f](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/49d6e5f32634864c9a368c738380449a8e7b82e6))
* **admin:** make validation table URLs clickable ([74c5c7d](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/74c5c7d77ce4aff9f9d29f0e6dcdc5973ab3dac3))
* enhance ValidationModal UI with stacked URLs, expand/collapse all, and better details layout ([042b356](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/042b3564bea77d2326485728b58b58e5fda95c2b))
* global redirect rules and extended logging ([537947b](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/537947bdeccda9b9c6d9370b8c16ced304716225))
* Link version number in footer to GitHub repository ([7b78665](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/7b786651e1889033867f541c7a1935c1c8d44150))


### Reverts

* undo changes to footer visibility ([b616e16](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/b616e16c2eb0213ead3e67c352628c98991d8579))

# [2.16.0](https://github.com/DrunkenHusky/SmartRedirectSuite/compare/v2.15.0...v2.16.0) (2026-02-04)


### Bug Fixes

* **admin:** left-align Handling Mode in Rules Table ([37f2c9c](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/37f2c9cdf6b209788a5385270913bbc3e2571fb0))
* change smart search path matcher to simple prefix match ([3ae427a](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/3ae427a4038336f0490a65cfddf5913d194011eb))
* correct JSX syntax in RulesTable.tsx caused by malformed sed replacement ([4211706](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/4211706d676cdd58ed3a26bc92ef6d4077edc659))
* decode extracted search terms before re-encoding or skipping ([7a4821b](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/7a4821b7d1d27e423ce26f18ef727eca69371a77))
* enable search and replace saving and verify stats update ([a90fb1a](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/a90fb1a836336afeed13a7821c45be0e80b88a5f))
* ensure first statistics entry records NOK feedback on fallback ([8883852](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/8883852c3bfe8c4d5b5b2d62bddf22f018872029))
* Include keptQueryParams in import/export logic ([5e4b827](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/5e4b827cfb0beb83589accd364991e524bfeed23))
* optimize import logic for CSV/XLSX and JSON, add missing fields to sample files, and improve UI ([da297c2](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/da297c2a577ba8da52ebb6a29386674f5e23d2ba))
* prevent duplicate smart search suggestion on feedback ([2cef3b7](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/2cef3b7a74645ca473fbc9d79b05bc731f130509))
* prioritize specific regex rules in smart search precedence ([821b02c](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/821b02cebce1b236746e36bd1e5c1fe39d9214c3))
* resolve admin UI crash and simplify wildcard parameter logic ([8b9952e](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/8b9952efc0132c5b4d189fe9a48d961367bca944))


### Features

* add feedback comment feature and improve stats chart ([bd1023a](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/bd1023a57362adfba81e1552e99c5c9f0769aa89))
* add interactive stats, trend chart, and rename Top 100 to Overall ([28c2212](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/28c22125bdfd1743395bcdca5cda182f3a9b30e1))
* Add kept parameters option for partial rules ([875f122](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/875f1225c66133e094f3d5c6d4dc64a8342d3de2))
* Add link quality and feedback graphics to Overall stats, rename Top 100 to Overall ([40309d7](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/40309d7b350a941aeabcd7a9644ce19056f7e04c))
* add partial rules for keeping query params ([ed98951](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/ed98951cbd76d62b64d922857c0de278951ccd46))
* add Search & Replace and enhance Wildcard rule parameter handling ([f5d4024](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/f5d4024dcc45153bdd79cc3304d51f1f9798631e))
* add static params and renaming to partial rules ([7c6d473](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/7c6d47381ff17d38fc137e90e151cd1ea6234c72))
* **admin:** enhance statistics charts with interactivity and dynamic labels ([eadfd45](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/eadfd457f2f63377d0cb83c066077aa137314b9a))
* dynamic fallback survey and customizable question ([da96d20](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/da96d2073c8750985d8140c8b3cb586b135cdfc4))
* enhance admin settings validation with inline errors and auto-scroll ([edcf2cc](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/edcf2cc533a171f6734bf1ba0cfa7c0837d1f5c5))
* enhance admin settings validation with inline errors and auto-scroll ([3e59c68](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/3e59c68d05abc9b2a0c92714850120ea35766473))
* enhance feedback flow with auto-redirect handling and smart search fallback ([50d53fb](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/50d53fb5a2a255a892eae48cf2089a1bb036a23c))
* global smart search encoding option and ui polish ([26c7876](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/26c78765be7faf0e442c038257f1a041adf5ce98))
* implement multiple regex support for smart search ([782dd8f](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/782dd8f0a7a0caff2eab7ac1aa6979a2bef2b8d7))
* make regex pattern optional in smart search ([c21cc04](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/c21cc0478307ceb59a3b7dfa19bc8178c2770cf5))
* make smart search encoding configurable per rule ([e305f18](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/e305f181d8da57455ee416845b3093629d8baa0d))
* param skip encoding and chart improvement ([1c51090](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/1c510905113c881613f8155281142be16ca82a40))
* refine feedback stats and chart ([055d919](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/055d91903c8b6860e72afc20532a3eb733b0e1ff))
* refine sample files for new features ([15a2a59](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/15a2a595b6762aae0b0abe9d8f37ec889a0dba24))
* show Zod validation errors in admin settings popup ([4b29e24](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/4b29e24d60c377abeb6966917fb72ee8920a23f5))
* update import/export for Search & Replace and params ([19c906e](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/19c906e50f2ab969105b7f033c81a78a5ce9c764))


### Reverts

* ci-cd changes and fix sample data ([ee752ce](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/ee752cee366d71516f13e75410389e604100f350))

# [2.15.0](https://github.com/DrunkenHusky/SmartRedirectSuite/compare/v2.14.0...v2.15.0) (2026-01-13)


### Bug Fixes

* add missing Share2 icon import in AdminPage ([c02f374](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/c02f374ee07d7f803646bea67825f9b45049f763))
* Improve feedback tracking context and update default texts ([4ca5993](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/4ca5993883a68aa59be6fba3b34f50c6565189be))
* Improve settings validation and UI for feedback survey ([5ab996a](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/5ab996ac8ae653a3ed88fb01f7e5586d079fe671))
* initialize enableReferrerTracking in AdminPage state ([043b9d1](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/043b9d15a40205571eac366bf619e4cf94fc6fe1))
* refresh schema definition for referrer tracking ([c2e02f9](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/c2e02f9a1fb062c8da4fe050129aa84c4cf016f7))
* **security:** handle HTTP parameter pollution in admin search ([7435694](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/7435694f83034134fa7686915e8e2fb57252c3f5))
* **tracking:** add referrer field to urlTrackingSchema ([6d487f9](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/6d487f9ee5de965c0b212f975962681bb5647369))


### Features

* **a11y:** add aria-labels to admin header buttons ([d654b44](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/d654b44eb8c9a6c7be55858c49274f511882dea8))
* **a11y:** improve keyboard accessibility for QualityGauge tooltip ([5a83b84](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/5a83b84489fc1e04f9302f214940eb5284a8c88f))
* add configurable max statistics entries limit ([d23b274](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/d23b274147eaeccc5c78d0cf6ba16dd5fde2bd96))
* add descriptions to fallback strategy dropdown options ([21ae015](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/21ae015385f975d54561c3946d240916729951e3))
* add referrer tracking and analytics ([36a72b7](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/36a72b71d755f8ebafe4c1f21af0752ca275ad49))
* implement Smart Search Fallback and optimize Admin UI performance ([97f7769](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/97f77696fe9f26ed2dcbfdc44357b2363c76c582))
* improve user feedback tracking mechanism ([41b435c](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/41b435cbc7e7abb650031619e0aecd36e10074f6))
* include Rule GUID, Feedback, and Quality in statistics export ([3124d68](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/3124d6829fd5e921ca517cf168e0b58c01679400))
* Localize Admin Settings to German ([1677764](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/167776459d3fb1b066f26b6dd219486ed5685541))
* make 'New URL' in stats table clickable ([66d69be](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/66d69be6bdd0a8f139c00c4f0acbb7d8c899fd64))
* make feedback survey buttons configurable ([2403ce4](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/2403ce482681ef88ac8f5ff5b2a28345a892cea5))
* make referrer tracking optional via settings ([5888dc2](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/5888dc22bdd21e6d0274f8bf2ce4ce83da2f06aa))
* remove 'New' and 'Legacy' labels from search features ([44be14d](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/44be14d2ab96b4271ba853f1380bd1783df29740))
* sanitize CSV and Excel exports to prevent formula injection ([14fb575](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/14fb575fcada23ec40ba1136aaceec46b43fe94a))
* simplify link quality gauge levels to 0/50/75/100 ([590d1db](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/590d1dbdc858aef15e798fd2f019fc742af568da))
* **ui:** make new url code block clickable ([60e214b](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/60e214b764a0adef4f4dd53b9cdd240d8756631f))
* update default background colors to hex code #ffffff ([acdc086](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/acdc0865d3f1ad49be1a151c26bd01d930f201cc))
* User Feedback Survey implementation ([3b25540](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/3b25540f1b77d9d8057a980455e8b79f850a1565))
* User Feedback Survey implementation ([9354c9d](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/9354c9d04ec28b7920d42b110d47a4fff788988b))
* User Feedback Survey implementation ([226426a](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/226426a262900a2ba0795b1dfc8b7db4982e9f27))
* User Feedback Survey integration ([d61575a](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/d61575a7067f73ede3c2d83afbb62979429ecbd4))
* warn when enabling stats limit and prune on save ([a191b7a](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/a191b7a1f10b66c29a004eeea5bd335186fd7558))
* warn when enabling stats limit and prune on save ([5a5a7a8](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/5a5a7a8e3295b3c1020ae4e2321786149374c089))
* warn when reducing stats limit ([947d626](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/947d626047ef9268ffcdaee416e95da65fc26d76))


### Performance Improvements

* Optimize tracking stats calculation ([1808b23](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/1808b23ce5109fe4642c0bfb0f4d14ff57cc03b5))
* **storage:** optimize file reading and rule processing ([b7e1fe6](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/b7e1fe673ab07f74a7a0b3f4932cfb46d137bbb1))
* **storage:** optimize file reading and rule processing ([b81cc14](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/b81cc1472f426973f15a766f87d0646119f05b79))

# [2.14.0](https://github.com/DrunkenHusky/SmartRedirectSuite/compare/v2.13.0...v2.14.0) (2025-12-17)


### Bug Fixes

* **auth:** resolve stuck login dialog state and add timeout ([458591f](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/458591f29d6a6361afae9f21fa9979423180162f))
* **tracking:** ensure match quality is sent in tracking requests ([5f33804](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/5f33804e507f381760d4ea058af2f3fcd87f29f3))


### Features

* add link quality indicator and filter to statistics ([a1426d0](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/a1426d04e32ba5256467673d33a3d545cd14ba99))
* clear all sessions on server startup ([0929679](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/0929679a8255fd18ed2a919106cb39872118feaa))
* handle orphaned rules in statistics table ([a6c9fef](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/a6c9fefd90747a2eb65dc051302702d77b7f9af1))
* handle orphaned rules in statistics table ([70a16fa](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/70a16faf7abd4b066883ee590c45461b7778a427))

# [2.13.0](https://github.com/DrunkenHusky/SmartRedirectSuite/compare/v2.12.0...v2.13.0) (2025-12-17)


### Bug Fixes

* **admin:** improve mobile layout for System & Data tab ([0e2c5ce](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/0e2c5ce547df2a25415d0ae79cf0c74e0e68fd17))
* **data:** remove incorrect '/test-rule' from initial rules ([ffc9cce](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/ffc9ccea01ecd07c80ba2f4e68ce74d77e12f597))
* **security:** prevent path traversal in local file uploads ([d430f6d](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/d430f6dfb346ed84784857b0bcf231e812acd455))
* **security:** prevent path traversal in local file uploads ([3d75eda](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/3d75eda83552b0355d9ee1407a6b92853f5d8f84))
* **server:** correct static asset path in production ([5323a3f](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/5323a3f580d1102873d4bbeec083a3a7b7662a0d))
* **server:** correct static asset path in production ([5ea2462](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/5ea2462c59d4ccd73e3dc4a09480d735d31214aa))


### Features

* **a11y:** add aria-labels to icon-only buttons in admin ([a91c19c](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/a91c19ca9848f721b97e0753be9c01d9764e6df7))
* add draggable column resizing to admin tables ([2ed5e05](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/2ed5e054cb594ede6fb3b48fd9108da6d422e83f))
* inject commit hash as version during fly deployment ([9cf8313](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/9cf831355c53ce49acd1c65d7bfd9e4d2201ad28))
* make statistics table responsive with horizontal scroll and resizable columns ([29e9dc1](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/29e9dc1d873a7e0371c657418dd7a143183f4ace))
* Manage blocked IPs, export, and clear functionality ([8b940ce](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/8b940cee20cbdd6cce3b3325ce2ea317c6036f3b))
* secure session secret generation ([8449625](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/84496254416bbb669eccd926e70a949a3895d56d))
* **security:** implement CSRF protection for admin API ([4f156d8](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/4f156d887925ad789f4b0c34e93b4bcc84358664))
* **storage:** implement tracking cache to optimize I/O ([0747edf](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/0747edfb8ed7f532a7926c0d5da0c128adc27079))
* **storage:** make tracking cache configurable and move tests ([36ac82b](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/36ac82b96a0d30b27367bb02693a15f58abe606b))
* **ui:** improve copy button feedback and accessibility ([f185d4a](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/f185d4a0ccc2b142bbf1bc1a02c09b695ca1973c))


### Performance Improvements

* lazy load AdminPage to reduce initial bundle size ([32da3d9](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/32da3d941c07a7b0eabc7bd312a843872dacde48))
* Optimize tracking stats pagination to O(1) for default view ([854e055](https://github.com/DrunkenHusky/SmartRedirectSuite/commit/854e055c272c824aea6fdfcd4c7e9d4ade6c28a4))

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
