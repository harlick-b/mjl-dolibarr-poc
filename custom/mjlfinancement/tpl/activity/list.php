<?php

ob_start();
mjl_activity_render_list($view);
return ob_get_clean();
