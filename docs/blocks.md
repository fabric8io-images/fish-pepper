### Blocks

One of the major features of fish-peppers are reusable
**blocks**. These are reusable components which can be parameterized
like any other template. A block itself can consist of two different
kinds:

* **template snippets** which will be inserted as a template fragment
  where referenced from within a template
* **files** which are copied over into the Docker build direct.

These blocks can be defined locally or referenced remotely and a
referenced by a unique ame. It is easy to share blocks across multiple
image deinitions. The following two sections explain how to use blocks
and how to create blocks.

#### Usage

Defined Blocks can be referenced from within templates with a function
on the template context. 

```javascript
{{= fp.block('version-info') }}
```

will refer to a block named "version-info". This block is processed as
a template which receives the same context as the calling
template. The processed content is the insert in place where the
method is called.

Sub-snippets can be declared with an optional second argument:

```javascript
{{= fp.block('version-info','java') }}
```

An (optional) third argument specifies additional processing
instructions and additional arguments for the blocks as an JavaScript
object: 

```javascript
{{= fp.block('version-info','java',{ "no-files": true, "copy-dir" :
"/usr/local/sti" }) }}
```

Processing instructions all start with `fp-`. The followin
instructions are support:

* `fp-no-files` : Don't copy over any files into the build directory

#### Definition

Blocks are stored in dedicated `blocks/` directories. These will be
looked up in multiple locations:

* Top-level `blocks/` directory where you global `fish-pepper.yml` resides. The blocks
  defined here are available across all defined images.
* `blocks/` directory on the image level where `images.yml` is located.
* The location referenced in the `blocks:` sections in
  `fish-pepper.yml`. 

There are two kind of blocks.

##### Simple blocks

Simple blocks are files within the blocks directory. They can have an
arbitrary file extension which should match the content. The name
before the extension defines the block name. E.g. a file
`version-info.md` in on of the `blocks/` directories or in one of the
locations referenced in the configuration will defined a block named
"version-info" (and is probably written in markdown). This block can
easily be referenced from within a template with `{{=
fp.block('version-info') }}`. The text itself is a template, too and
is processed before inserted. 

The block itself can reference the `fp` context object as described in
[Templates](#templates). In addition is access to extra information
which is available only for this block. This information is available
as an object via the property `fp.blockContext` and has the following
properties:

* `name` : Name of the block
* `subname` : Sub-snippet name (which is empty for simple blocks)
* `opts` : Extra option given a third argument to the block call

##### Extended blocks

Extended blocks consist of multiple files which are stored within a
directory in the blocks location. The name of the directory is also
the block name. Any file within this directory defines a
sub-snippet. The base filename of the sub snippets are the name of
the sub-snippets, the extension can be anything. This directory can
also contain a directory `fp-files` which holds files which should be
copied over into a Docker build directory. This directory can hold
other directories, which are deeply copied.

For example consider the following setup:

```

blocks/
  |
  +-- run-sh/
       |  
       +-- run-commands.dck
       +-- readme.md
       +-- fp-files
               |
               +-- run.sh

```

This defines a block named `run-sh` with the template snippets
`run-commands.dck` and `readme.md`. The former holds the ADD command
to put into the Dockerfile via `{{=
fp.block('run-sh','commands.dck')}}`. This will also copy over all
files in `fp-files` directory, in this case `run.sh`. Alls files
copied are also processed as templates. The `readme.md` contains the usage
instructions which can be included in the README template with `{{=
fp.block('run-sh','readme.md',{ 'fp-no-files' : true }) }}`. The third
argument to this call indicates that no files should be copied in
this case. 

##### Remote Blocks

Blocks can be also defined in a Git repository which must be
accessible with `https`. These external references are defined in the
main `fish-pepper.yml` configuration file in a dedicated `blocks`
section.

For example

```yml
blocks:
  - type: "git"
    url: "https://github.com/fabric8io/run-java-sh.git"
    path: "fish-pepper"
```

The `blocks` sections contains a list of external references. This
external reference has a type (currently only `git` is supported), an
access URL (`https` is mandatory for now). Optionally a `path` pointing
in this Git Repo is provided. This directory is then used as a blocks
directory as described above.

If `type` is omitted, the type is extracted from the `url` (i.e. if 
it ends with `.git` its of type "git"). If instead of an object a string
is provided as block, this string is interpreted as URL. If no `path` is given, 
the defaul path `fish-pepper` is assumed. The example above hence can 
be written also as

```yml
blocks:
  - "https://github.com/fabric8io/run-java-sh.git"
```

By default `master` is checked out, but this can be influenced either
with a `tag` or `branch` property in which case the specific
tag or branch is used. 

