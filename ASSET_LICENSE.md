# Asset Licensing

Pawse separates source code licensing from pet animation asset licensing.

## Source Code

The application source code is licensed under the MIT License. See `LICENSE`.

## Bundled Runtime Assets

Files under `pet_assets/` are bundled runtime assets used by the app's built-in pet appearances.

These assets are not automatically covered by the MIT License unless a specific asset source explicitly grants MIT-compatible rights. Before redistributing, remixing, or using a pet asset outside this project, verify the original asset source and license.

Current built-in appearances:

- `pet_assets/金毛 puppy/`
- `pet_assets/线条小狗/`

## Raw Working Assets

Raw source materials live under `_raw_assets/` locally and are intentionally excluded from git.

The raw asset folder may contain generated experiments, upstream packs, original videos, intermediate exports, or other large files. Do not commit `_raw_assets/` to the public repository.

## Contributing Assets

When contributing a new pet appearance or replacing GIFs, include clear source and license information in the pull request. Prefer assets that can be redistributed with the project, and avoid adding files whose rights are unclear.
