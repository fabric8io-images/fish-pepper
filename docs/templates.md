### Templates

Fish pepper templates are
[DoT.js](http://olado.github.io/doT/index.html) templates. It is a
fast template library which allows for the full expressiveness of
JavaScript. Its a bit similar to JSP or PHP. The template syntax is
described in detail [here] (section "Usage").

The most important directives are

* {% raw %}`{{= ... }}`{% endraw %} will evaluate the JavaScript within the parentheses and
  evaluate it as string which then is inserted literally into the
  text.
* {% raw %}`{{ ... }}`{% endraw %} will add the JavaScript code (which can be partially
  complete only) to the generated JavaScript rendering
  function. E.g.
{% raw %}

        {{ images.forEach(function image) { }}
        * {{= image.name }}
        {{ } }}

{% endraw %}
  will iterate over `images` (which needs to be initialized
  beforehand) and create a bullet list of the image names.
* {% raw %}`{{~ array :value:index}}`{% endraw %} can be used as shortcut for iteration
  over arrays. So, the example above can be written more elegantly
  with 
{% raw %}

        {{~ images :image:index}}
        * {{= image.name }}
        {{~}}
{% endraw %}
* With {% raw %}`{{? if-condition} ... {{?? else-if-conition}} ... {??} (else)
... {{?}}`{% endraw %} conditions can be build up easily:
{% raw %}

        {{? images.length > 1 }}
          More than one image
        {{?? images.length == 1 }}
          Exactly one image 
        {{??}}
          No image
        {{?}}

{% endraw %}

#### Template context

All fish-pepper templates have access to the fish-pepper context
object. This accessible as variable **fp** from within the templates.

The **fp** context has the following properties:

* `param` is a map holding the current parameter values. As described
  in [Configuration](#images.yml) template are evaluated for every
  parameter values tuple. In each iteration the `param` property holds
  a map with the current parameter values. For the example above e.g
  when the current parameter values are `version == "openjdk7"` and
  `type == "jdk"` then `fp.param` is

        {
          version: "openjdk7"
          type: "jdk"
        }

* `config` is an object which holds the configuration for the
  selected parameter values for the current template
  evaluation. E.g. assuming the example configuration given
  [above](#images.yml), then when the template for the parameter
  values `version == 'openjdk8'` and `type == 'jre'` is used,
  then `fp.config.version.java` evaluated to `java:8u45` and
  `fp.config.type.extension` to `-jre`. The general scheme is
  `fp.config.`*parameter type* which references to the currently
  active parameter's configuration. 
* All other properties defined in `fish-pepper.yml` and `images.yml`
  are directly accesible as properties from `fp`, so you can easily
  define image global and global global properties. Properties with
  the same name in `images.yml` take precedence over the properties in
  `fish-pepper.yml`. 
* `block()` is a function to use [blocks](#blocks)

Examples of the context usage can be found in the
[templates](example/java/templates) used in the Java fish-pepper demo
included in this repository. 
