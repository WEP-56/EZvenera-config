# EZVenera-config

Configuration repository for EZVenera comic source plugins.

Current strategy:

- start from the original Venera source set
- keep compatibility with EZVenera's simplified runtime
- gradually clean, verify and evolve sources under EZVenera maintenance

## Runtime Compatibility

EZVenera currently keeps these plugin areas:

- `account`
- `search`
- `category`
- `categoryComics`
- `comic.loadInfo`
- `comic.loadEp`
- `comic.onImageLoad`
- `comic.onThumbnailLoad`
- `settings`
- `comic.link`
- `comic.idMatch`

Unsupported fields may still exist in source files for original Venera compatibility, but EZVenera ignores them.

## Create or Update a Source

1. Put `_template_.js` and `_venera_.js` in the same directory.
2. Rename `_template_.js` to your source file name.
3. Implement the retained EZVenera capability set first.
4. Update `index.json` when adding or publishing a source.

## Repositories

App:

- [WEP-56/EZVenera](https://github.com/WEP-56/EZVenera)

Source configs:

- [WEP-56/EZvenera-config](https://github.com/WEP-56/EZvenera-config)
