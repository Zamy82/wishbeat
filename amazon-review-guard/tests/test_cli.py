from review_guard.cli import build_parser, main


def test_parser_requires_a_command():
    import pytest

    with pytest.raises(SystemExit):
        build_parser().parse_args([])


def test_cli_fetch_runs_end_to_end(project, capsys):
    csv_path = project.source_path("path")
    csv_path.parent.mkdir(parents=True, exist_ok=True)
    csv_path.write_text(
        "review_id,asin,rating,title,body,url\nR1,B000000000,5,Hi,Body text here,https://x/R1\n",
        encoding="utf-8",
    )
    config_file = project.base_dir / "config.yaml"
    rc = main(["--config", str(config_file), "fetch"])
    assert rc == 0
    assert "fetched 1 reviews" in capsys.readouterr().out
