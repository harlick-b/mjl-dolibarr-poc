<?php

ob_start();
mjl_activity_render_form($view);
return ob_get_clean();
