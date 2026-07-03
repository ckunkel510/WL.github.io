#!/usr/bin/env python3
"""Extract WebTrack's department menu into a compact JSON data file."""

from __future__ import annotations

import argparse
import html
import json
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urljoin


class DepartmentMenuParser(HTMLParser):
    def __init__(self, base_url: str) -> None:
        super().__init__(convert_charrefs=True)
        self.base_url = base_url
        self.in_department_list = False
        self.department_list_depth = 0
        self.li_depth = 0
        self.current_department = None
        self.current_link = None
        self.departments = []

    @staticmethod
    def _classes(attrs):
        return set(dict(attrs).get("class", "").split())

    def handle_starttag(self, tag, attrs):
        attrs_dict = dict(attrs)
        classes = self._classes(attrs)

        if tag == "ul" and not self.in_department_list and "rmLevel1" in classes:
            self.in_department_list = True
            self.department_list_depth = 1
            return

        if not self.in_department_list:
            return

        if tag == "ul":
            self.department_list_depth += 1

        if tag == "li":
            self.li_depth += 1
            if self.li_depth == 1:
                self.current_department = {"name": "", "href": "", "subcategories": []}

        if tag != "a" or not self.current_department:
            return

        href = attrs_dict.get("href")
        if not href:
            return

        kind = None
        if self.li_depth == 1 and "rmLink" in classes:
            kind = "department"
        elif self.li_depth >= 2 and "rsmLink" in classes:
            kind = "subcategory"

        if kind:
            self.current_link = {
                "kind": kind,
                "href": urljoin(self.base_url, html.unescape(href)),
                "text": [],
            }

    def handle_data(self, data):
        if self.current_link:
            self.current_link["text"].append(data)

    def handle_endtag(self, tag):
        if not self.in_department_list:
            return

        if tag == "a" and self.current_link and self.current_department:
            name = " ".join("".join(self.current_link["text"]).split())
            if name:
                if self.current_link["kind"] == "department":
                    self.current_department["name"] = name
                    self.current_department["href"] = self.current_link["href"]
                else:
                    self.current_department["subcategories"].append(
                        {"name": name, "href": self.current_link["href"]}
                    )
            self.current_link = None

        if tag == "li":
            if self.li_depth == 1 and self.current_department:
                if self.current_department["name"] and self.current_department["href"]:
                    seen = set()
                    unique = []
                    for item in self.current_department["subcategories"]:
                        key = (item["name"], item["href"])
                        if key in seen:
                            continue
                        seen.add(key)
                        unique.append(item)
                    self.current_department["subcategories"] = unique
                    self.departments.append(self.current_department)
                self.current_department = None
            self.li_depth -= 1

        if tag == "ul":
            self.department_list_depth -= 1
            if self.department_list_depth == 0:
                self.in_department_list = False


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("destination", type=Path)
    args = parser.parse_args()

    menu_parser = DepartmentMenuParser("https://webtrack.woodsonlumber.com/")
    menu_parser.feed(args.source.read_text(encoding="utf-8", errors="replace"))

    payload = {
        "version": 1,
        "source": "WebTrack department menu",
        "departments": menu_parser.departments,
    }
    args.destination.write_text(
        json.dumps(payload, ensure_ascii=True, indent=2) + "\n", encoding="utf-8"
    )


if __name__ == "__main__":
    main()
