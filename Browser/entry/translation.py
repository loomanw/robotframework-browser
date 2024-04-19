import hashlib
import inspect
import json
from pathlib import Path
from typing import List, Optional

KEYWORD_NAME = "Keyword name"
DOC_CHANGED = "Documentation update needed"
NO_LIB_KEYWORD = "Keyword not found from library"
MISSING_TRANSLATION = "Keyword is missing translation"
MISSING_CHECKSUM = "Keyword tranlsaton is missing checksum"


def get_library_translaton(
    plugings: Optional[str] = None, jsextension: Optional[str] = None
) -> dict:
    from Browser import Browser

    browser = Browser(plugins=plugings, jsextension=jsextension)
    translation = {}
    for function in browser.attributes.values():
        translation[function.__name__] = {
            "name": function.__name__,
            "doc": function.__doc__,
            "sha256": hashlib.sha256(function.__doc__.encode("utf-16")).hexdigest(),
        }
    translation["__init__"] = {
        "name": "__init__",
        "doc": inspect.getdoc(browser),
        "sha256": hashlib.sha256(inspect.getdoc(browser).encode("utf-16")).hexdigest(),  # type: ignore
    }
    translation["__intro__"] = {
        "name": "__intro__",
        "doc": browser.__doc__,
        "sha256": hashlib.sha256(browser.__doc__.encode("utf-16")).hexdigest(),  # type: ignore
    }
    return translation


def _max_kw_name_lenght(project_tanslation: dict) -> int:
    max_lenght = 0
    for keyword_data in project_tanslation.values():
        if (current_kw_length := len(keyword_data["name"])) > max_lenght:
            max_lenght = current_kw_length
    return max_lenght


def _max_reason_lenght() -> int:
    return max(
        len(DOC_CHANGED),
        len(NO_LIB_KEYWORD),
        len(MISSING_TRANSLATION),
        len(MISSING_CHECKSUM),
    )


def _get_heading(max_kw_lenght: int) -> List[str]:
    heading = f"| {KEYWORD_NAME} "
    next_line = f"| {'-' * len(KEYWORD_NAME)}"
    if (padding := max_kw_lenght - len(heading) - 1) > 0:
        heading = f"{heading}{' ' * padding}"
        next_line = f"{next_line}{'-' * padding}"
    reason = "Reason"
    reason_padding = _max_reason_lenght() - len(reason)
    heading = f"{heading}| {reason}{' ' * reason_padding}|"
    next_line = f"{next_line} | {'-' * (_max_reason_lenght() -1)} |"
    return [heading, next_line]


def _table_doc_updated(lib_kw: str, max_name_lenght: int, reason: str) -> str:
    line = f"| {lib_kw} "
    if (padding := max_name_lenght - len(lib_kw) - 4) > 0:
        line = f"{line}{' ' * padding}| {reason} "
    else:
        line = f"{line}| {reason} "
    if reason == DOC_CHANGED:
        line = f"{line}{' ' * 11}"
    return f"{line}|"


def compare_translatoin(filename: Path, library_translation: dict):
    with filename.open("r") as file:
        project_translation = json.load(file)
    max_kw_lenght = _max_kw_name_lenght(library_translation)
    table_body = []
    for lib_kw, lib_kw_data in library_translation.items():
        project_kw_data = project_translation.get(lib_kw)
        if not project_kw_data:
            table_body.append(
                _table_doc_updated(lib_kw, max_kw_lenght, MISSING_TRANSLATION)
            )
            continue
        sha256_value = project_kw_data.get("sha256")
        if not sha256_value:
            table_body.append(
                _table_doc_updated(lib_kw, max_kw_lenght, MISSING_CHECKSUM)
            )
            continue
        if project_kw_data["sha256"] != lib_kw_data["sha256"]:
            table_body.append(_table_doc_updated(lib_kw, max_kw_lenght, DOC_CHANGED))
    for project_kw in project_translation:
        if project_kw not in library_translation:
            table_body.append(
                _table_doc_updated(project_kw, max_kw_lenght, NO_LIB_KEYWORD)
            )
    if not table_body:
        return []

    table = _get_heading(_max_kw_name_lenght(project_translation))
    table.extend(table_body)
    return table
