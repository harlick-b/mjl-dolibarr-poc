<?php

return mjl_page_header_render($view['config']['title'], $view['header_options'])
	.mjl_reference_ui_list($view['kind'], $view['config'], $view['rows'], $view['can_manage']);
