<?php

ob_start();
mjl_activity_render_detail($view);
return ob_get_clean();
